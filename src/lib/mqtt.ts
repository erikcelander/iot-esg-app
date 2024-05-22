import { useEffect } from "react";
import mqtt, { MqttClient } from "mqtt";

const connection = createMqttConnection(
  process.env.NEXT_PUBLIC_YGGIO_MQTT_URL!,
  "iot-esg-app-set",
  "super-secret-password",
);

export const useMqtt = (setID: string, nodeID: string, onMessage: Function) => {
  useEffect(() => {
    const topic = `yggio/output/v2/${setID}/iotnode/${nodeID}`;
    const subscription = connection.subscribe(topic, onMessage);
    return () => subscription.unsubscribe();
  }, [setID, nodeID, onMessage]);
};

function createMqttConnection(url: string, username: string, password: string): Connection {
  const subscribers: Map<string, Function[]> = new Map();
  let currentClient: MqttClient | null = null;

  function createClient() {
    console.log("Creating new MQTT client connection.");
    const client: MqttClient = mqtt.connect(url, { username, password });

    client.on("connect", () => {
      // After calling the end method, which puts the client in the
      // disconnecting state, the connect event can still be triggered
      // but the subscribe method throws an error.
      if (client.disconnecting) return;

      console.log("Client connected.");
      Array.from(subscribers.keys())
        .filter(topic => !subscribers.has(topic))
        .forEach(topic => addSubscriptionTopic(client, topic));
    });

    client.on("message", (topic, message) => {
      const callbacks = subscribers.get(topic);
      callbacks?.forEach(callback => callback(topic, message))
    });

    return client;
  }

  function subscribeClient(topic: string) {
    const client = currentClient === null
      ? currentClient = createClient()
      : currentClient;

    if (client.connected) {
      addSubscriptionTopic(client, topic);
    }
  }

  function unsubscribeClient(topic: string) {
    console.log("Unsubscribing client from topic:", topic);
    currentClient?.unsubscribe(topic);
  }

  function addSubscriptionTopic(client: mqtt.MqttClient, topic: string) {
    console.log("Subscribing client to topic:", topic);
    client.subscribe(topic, (err) => {
      if (err) {
        console.error("Failed to subscribe to topic", err);
      } else {
        console.log("Subscribed to topic:", topic);
      }
    });
  }

  return {
    subscribe(topic: string, onMessage: Function): Subscription {
      console.log("Adding subscription callback for topic:", topic);

      if (!subscribers.has(topic)) {
        subscribers.set(topic, []);
      }
      const callbacks = subscribers.get(topic)!;
      callbacks.push(onMessage);

      if (callbacks.length === 1) {
        subscribeClient(topic);
      }

      return {
        unsubscribe() {
          console.log("Removing subscription callback for topic:", topic);

          const callbacks = subscribers.get(topic) ?? [];
          const index = callbacks.indexOf(onMessage);
          if (index > -1) {
            callbacks.splice(index, 1);
          }

          if (callbacks.length === 0) {
            unsubscribeClient(topic);
          }
        }
      }
    }
  }
}

interface Connection {
  subscribe(topic: string, onMessage: Function): Subscription
}

interface Subscription {
  unsubscribe(): void
}
