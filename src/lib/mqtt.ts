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
  let subscribers = new Map<string, any[]>()

  function createClient() {
    let c = clientFactory()
    c.on("connect", () => {
      let topics = Array.from(subscribers.keys())
      topics.forEach(topic => c.subscribe(topic, err => {}))
    })
    c.on("message", (topic, message) => {
      subscribers.get(topic)
        ?.forEach(callback => callback(topic, message))
    })
    return c
  }

  return {
    subscribe(topic, onMessage) {
      client = client ?? createClient()
      let isAlreadySubsribed = subscribers.has(topic)
      let callbacks = subscribers.get(topic) ?? []
      callbacks.push(onMessage)
      subscribers.set(topic, callbacks)
      if (client.connected && !isAlreadySubsribed) {
        client.subscribe(topic, err => {})
      }

      return {
        unsubscribe() {
          let callbacks = subscribers.get(topic) ?? []
          let index = callbacks.indexOf(onMessage)
          if (index !== -1) {
            callbacks.splice(index, 1)
          }
          if (callbacks.length === 0) {
            client!.unsubscribe(topic)
          }
        }
      }
    },
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
