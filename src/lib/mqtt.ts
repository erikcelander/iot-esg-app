import { useEffect, useState } from "react";
import mqtt, { MqttClient } from "mqtt";

export const useMqtt = (setID: string, nodeID: string, onMessage: Function) => {
  const [currentConnection, setCurrentConnection] = useState<Connection|null>(null);

  useEffect(() => {
    const topic = `yggio/output/v2/${setID}/iotnode/${nodeID}`;

    let connection;
    if (currentConnection === null) {
      const url = process.env.NEXT_PUBLIC_YGGIO_MQTT_URL!;
      const username = "iot-esg-app-set";
      const password = "super-secret-password";
      connection = createMqttConnection(url, username, password);
      setCurrentConnection(connection);
    }
    else {
      connection = currentConnection;
    }

    connection.subscribe(topic, onMessage);

    // return () => {
    //   console.log("Disconnecting from MQTT broker");
    //   client.end();
    // };

  }, [setID, nodeID, onMessage]);
};

interface Connection {
  subscribe(topic: string, onMessage: Function): void
}

function createMqttConnection(url: string, username: string, password: string): Connection {
  let isConnected = false;

  const subscribers: Map<string, Function[]> = new Map();
  const clientSubscriptions = new Set<string>();

  const client = mqtt.connect(process.env.NEXT_PUBLIC_YGGIO_MQTT_URL!, {
    username: `iot-esg-app-set`,
    password: "super-secret-password",
  });

  client.on("connect", () => {
    Array.from(subscribers.keys())
      .filter(topic => !clientSubscriptions.has(topic))
      .forEach(topic => subscribeClient(topic));
  });

  client.on("message", (topic, message) => {
    const callbacks = subscribers.get(topic) ?? [];
    callbacks.forEach(callback => callback(topic, message))
  });

  function subscribeClient(topic: string) {
    client.subscribe(topic, (err) => {
      if (err) {
        console.error("Failed to subscribe to topic", err);
      } else {
        clientSubscriptions.add(topic);
        console.log(`Subscribed to topic: ${topic}`);
      }
    });
  }

  return {
    subscribe(topic: string, onMessage: Function) {
      let callbacks = subscribers.get(topic);
      if (callbacks === null || callbacks === undefined) {
        callbacks = [];
        subscribers.set(topic, callbacks);
      }
      callbacks.push(onMessage);

      if (!clientSubscriptions.has(topic)) {
        subscribeClient(topic);
      }
    }
  }
}