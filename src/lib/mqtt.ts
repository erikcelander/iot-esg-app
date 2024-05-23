import { useEffect } from "react";
import mqtt, { MqttClient } from "mqtt";
import { createContext, useContext } from 'react';




export const MyAwesomeContext = createContext<any>(null);

let providerCounter = 0;

export function myAwesomeGlobalProvider() {
  const providerId = ++providerCounter;
  console.log("It's my provider, yo!", providerId);
  // useEffect(() => {
  //   console.log("My provider setup!", providerId);
  //   return () => console.log("My provider teardown!", providerId);
  // })
}


const connection = createMqttConnection(
  () => mqtt.connect(
    process.env.NEXT_PUBLIC_YGGIO_MQTT_URL!,
    { username: "iot-esg-app-set", password: "super-secret-password", }),
  queueMicrotask
);


export const useMqtt = (setID: string, nodeID: string, onMessage: Function) => {
  useEffect(() => {
    const topic = `yggio/output/v2/${setID}/iotnode/${nodeID}`;
    const subscription = connection.subscribe(topic, onMessage);
    return () => subscription.unsubscribe();
  }, [setID, nodeID, onMessage]);
};

type ClientFactory = () => MqttClient
type UpdateTaskRunner = (task: () => void) => void

export function createMqttConnection(
  clientFactory: ClientFactory,
  updateTaskRunner: UpdateTaskRunner,
): Connection {
  return {
    subscribe(topic, onMessage) {
      let client = clientFactory()
      return {
        unsubscribe() {}
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
