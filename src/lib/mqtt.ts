import { useEffect } from "react";
import mqtt, { MqttClient } from "mqtt";

const connection = createMqttConnection(
  () => mqtt.connect(
    process.env.NEXT_PUBLIC_YGGIO_MQTT_URL!,
    { username: "iot-esg-app-set", password: "super-secret-password", }),
  queueMicrotask
);

export const useMqtt = (setID: string, nodeID: string, onMessage: Function) => {
  useEffect(() => {
    const topic = `yggio/output/v2/${setID}/iotnode/${nodeID}`;
    const onMessageWrapper = (topic: string, message: any) => {
      console.log("onMessage:", topic, message)
      onMessage(topic, message)
    }
    const subscription = connection.subscribe(topic, onMessageWrapper);
    return () => subscription.unsubscribe();
  }, [setID, nodeID, onMessage]);
};

type ClientFactory = () => MqttClient
type UpdateTaskRunner = (task: () => void) => void

export function createMqttConnection(
  clientFactory: ClientFactory,
  updateTaskRunner: UpdateTaskRunner,
): Connection {
  let client: MqttClient | null = null

  return {
    subscribe(topic, onMessage) {
      client = client ?? clientFactory()
      client.subscribe(topic, err => {})

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
