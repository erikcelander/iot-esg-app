import { useEffect } from "react";
import mqtt, { MqttClient } from "mqtt";

const connection = createMqttConnection(() => mqtt.connect(
    process.env.NEXT_PUBLIC_YGGIO_MQTT_URL!,
    { username: "iot-esg-app-set", password: "super-secret-password", }));

export const useMqtt = (setID: string, nodeID: string, onMessage: Function) => {
  useEffect(() => {
    const topic = `yggio/output/v2/${setID}/iotnode/${nodeID}`;
    const subscription = connection.subscribe(topic, onMessage);
    return () => subscription.unsubscribe();
  }, [setID, nodeID, onMessage]);
};

type ClientFactory = () => MqttClient
type UpdateTaskRunner = (task: () => void) => void
type Logger = (...args: any[]) => void

export function createMqttConnection(
  clientFactory: ClientFactory,
  updateTaskRunner: UpdateTaskRunner = queueMicrotask,
  logger: Logger = console.log,
): Connection {
  let client: MqttClient | null = null
  let subscribers = new Map<string, any[]>()

  const log = logger.bind(logger, "mqtt:")

  function createClient() {
    let c = clientFactory()
    c.on("connect", () => {
      log("Client connected.")
      let topics = Array.from(subscribers.keys())
      topics.forEach(topic => {
        log("Subscribing:", topic)
        return c.subscribe(topic, err => { });
      })
    })
    c.on("message", (topic, message) => {
      log("Message received:", topic, message)
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
        log("Subscribing:", topic)
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
            log("Unsubscribing:", topic)
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
