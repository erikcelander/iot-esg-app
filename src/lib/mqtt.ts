import { useEffect, useState } from "react";
import mqtt, { MqttClient } from "mqtt";

let connection: Connection | null = null;

export const useMqtt = (setID: string, nodeID: string, onMessage: Function) => {
  useEffect(() => {
    const topic = `yggio/output/v2/${setID}/iotnode/${nodeID}`;

    if (connection === null) {
      const url = process.env.NEXT_PUBLIC_YGGIO_MQTT_URL!;
      const username = "iot-esg-app-set";
      const password = "super-secret-password";
      connection = createMqttConnection(url, username, password);
    }

    const subscription = connection.subscribe(topic, onMessage);
    return () => subscription.unsubscribe();
  }, [setID, nodeID, onMessage]);
};

interface Connection {
  subscribe(topic: string, onMessage: Function): Subscription
}

interface Subscription {
  unsubscribe(): void
}

function createMqttConnection(url: string, username: string, password: string): Connection {
  const subscribers: Map<string, Function[]> = new Map();
  const clientSubscriptions = new Set<string>();

  console.log("Creating new MQTT client connection.");

  const client = mqtt.connect(process.env.NEXT_PUBLIC_YGGIO_MQTT_URL!, {
    username: "iot-esg-app-set",
    password: "super-secret-password",
  });

  client.on("connect", () => {
    console.log("Client connected.");
    Array.from(subscribers.keys())
      .filter(topic => !clientSubscriptions.has(topic))
      .forEach(topic => subscribeClient(topic));
  });

  client.on("message", (topic, message) => {
    const callbacks = subscribers.get(topic) ?? [];
    callbacks.forEach(callback => callback(topic, message))
  });

  function subscribeClient(topic: string) {
    console.log("Subscribing client to topic:", topic);
    client.subscribe(topic, (err) => {
      if (err) {
        console.error("Failed to subscribe to topic", err);
      } else {
        clientSubscriptions.add(topic);
        console.log("Subscribed to topic:", topic);
      }
    });
  }

  function unsubscribeClient(topic: string) {
    console.log("Unsubscribing client from topic:", topic);
    client.unsubscribe(topic);
    clientSubscriptions.delete(topic);
  }

  function disconnectClient() {
    console.log("Disconnecting from MQTT broker");
    client.end();
  }

  return {
    subscribe(topic: string, onMessage: Function): Subscription {
      console.log("Adding subscription callback for topic:", topic);

      let callbacks = subscribers.get(topic);
      if (callbacks === null || callbacks === undefined) {
        callbacks = [];
        subscribers.set(topic, callbacks);
      }
      callbacks.push(onMessage);

      if (!clientSubscriptions.has(topic)) {
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
          if (clientSubscriptions.size === 0) {
            console.log("No more subscribers!");
            //disconnectClient();
          }
        }
      }
    }
  }
}