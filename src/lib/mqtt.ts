import { useEffect } from "react";
import mqtt, { MqttClient } from "mqtt";
import { createContext, useContext } from 'react';




export const MyAwesomeContext = createContext<any>(null);

let providerCounter = 0;

export function myAwesomeGlobalProvider() {
  console.log("It's my provider, yo!", ++providerCounter);
}




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
  const topicStates = new Map<string, TopicState>();
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

      topicStates.clear();
      Array.from(subscribers.keys())
        .forEach(topic => subscribe(client, topic));
    });

    client.on("message", (topic, message) => {
      const callbacks = subscribers.get(topic);
      callbacks?.forEach(callback => callback(topic, message))
    });

    return client;
  }

  function subscribe(client: mqtt.MqttClient, topic: string) {
    switch (topicStates.get(topic)) {
      case TopicState.subscribing:
        console.log("Client currently subscribing to topic:", topic);
        break;
      case TopicState.subscribed:
        console.log("Client already subscribed to topic:", topic);
        break;
      case TopicState.unsubscribing:
        console.log("Client currently unsubscribing from topic:", topic);
        break;
      case null:
        console.log("Client subscribing to topic:", topic);
        topicStates.set(topic, TopicState.subscribing);
        client.subscribe(topic, err => {
          if (err) {
            topicStates.delete(topic);
            console.error("Failed to subscribe to topic", err);
          }
          else {
            topicStates.set(topic, TopicState.subscribed);
            console.log("Subscribed to topic:", topic);
          }
        });
        break;
      }
  }

  function unsubscribe(client: MqttClient, topic: string) {
    switch (topicStates.get(topic)) {
      case TopicState.subscribing:
        console.log("Client currently subscribing to topic:", topic);
        break;
      case TopicState.subscribed:
        console.log("Unsubscribing client from topic:", topic);
        topicStates.set(topic, TopicState.unsubscribing);
        client.unsubscribe(topic, undefined, err => {
          if (err) {
            topicStates.set(topic, TopicState.subscribed);
            console.error("Failed to unsubscribe from topic", err);
          }
          else {
            topicStates.delete(topic);
          }
        });
        break;
      case TopicState.unsubscribing:
        console.log("Client currently unsubscribing from topic:", topic);
        break;
      case null:
        console.log("Client already unsubscribed from topic:", topic);
        break;
    }
  }

  return {
    subscribe(topic: string, onMessage: Function): Subscription {
      console.log("Adding callback:", topic);

      if (!subscribers.has(topic)) {
        subscribers.set(topic, []);
      }
      const callbacks = subscribers.get(topic)!;
      callbacks.push(onMessage);

      if (callbacks.length === 1) {
        const client = currentClient === null
          ? currentClient = createClient()
          : currentClient;

        if (client.connected) {
          subscribe(client, topic);
        }
      }

      return {
        unsubscribe() {
          console.log("Removing callback:", topic);

          const callbacks = subscribers.get(topic) ?? [];
          const index = callbacks.indexOf(onMessage);
          if (index > -1) {
            callbacks.splice(index, 1);
          }

          if (callbacks.length === 0) {
            unsubscribe(currentClient!, topic);
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

enum TopicState {
  subscribing,
  subscribed,
  unsubscribing,
}
