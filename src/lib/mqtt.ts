import { useEffect } from "react";
import mqtt, { MqttClient } from "mqtt";

const connection = createMqttConnection(() => mqtt.connect(
    process.env.NEXT_PUBLIC_YGGIO_MQTT_URL!,
    { username: "iot-esg-app-set", password: "super-secret-password", }));

export const useMqtt = (setID: string, nodeID: string, onMessage: MessageCallback) => {
  useEffect(() => {
    const topic = `yggio/output/v2/${setID}/iotnode/${nodeID}`;
    const subscription = connection.subscribe(topic, onMessage);
    return () => subscription.unsubscribe();
  }, [setID, nodeID, onMessage]);
};

export function createMqttConnection(
  clientFactory: ClientFactory,
  taskRunner: TaskRunner = queueMicrotask,
  logger: Logger = console.log,
): Connection {
  let client: MqttClient | null = null
  let subscribers = new Map<string, MessageCallback[]>()
  let isUpdateScheduled = false
  let updates = {
    additions: new Set<string>(),
    removals: new Set<string>(),
  }

  const log = logger.bind(logger, "mqtt:")

  function createClient() {
    let c = clientFactory()
    c.on("connect", () => {
      log("Client connected.")
      scheduleUpdate({})
    })
    c.on("message", (topic, message) => {
      log("Message received:", topic, message)
      subscribers.get(topic)?.forEach(callback => {
        callback(topic, message);
      })
    })
    return c
  }

  function subscribe(topic: string, onMessage: MessageCallback): Subscription {
    client = client ?? createClient()
    let isAlreadySubsribed = subscribers.has(topic)
    let callbacks = subscribers.get(topic) ?? []
    callbacks.push(onMessage)
    subscribers.set(topic, callbacks)
    if (!isAlreadySubsribed) {
      scheduleUpdate({add: topic})
    }
    let unsubscriptionAction = unsubscribe.bind(null, topic, onMessage)
    return {
      unsubscribe() {
        unsubscriptionAction()
        unsubscriptionAction = () => {}
      }
    }
  }

  function unsubscribe(topic: string, onMessage: MessageCallback) {
    let callbacks = subscribers.get(topic) ?? []
    let index = callbacks.indexOf(onMessage)
    if (index !== -1) {
      callbacks.splice(index, 1)
      if (callbacks.length === 0) {
        subscribers.delete(topic)
        scheduleUpdate({remove: topic})
      }
    }
  }

  function scheduleUpdate({
    add = undefined,
    remove = undefined,
  }: {
    add?: string,
    remove?: string
  }) {
    if (add && !updates.removals.delete(add)) {
      updates.additions.add(add)
    }
    if (remove && !updates.additions.delete(remove)) {
      updates.removals.add(remove)
    }
    if (!isUpdateScheduled) {
      isUpdateScheduled = true
      taskRunner(() => {
        isUpdateScheduled = false
        updateSubscriptions()
      })
    }
  }

  function updateSubscriptions() {
    if (client?.connected) {
      updates.additions.forEach(topic => {
        log("Subscribing:", topic)
        client!.subscribe(topic, err => {
          if (err) log("Failed to subscribe:", err)
        })
      })
      updates.removals.forEach(topic => {
        log("Unsubscribing:", topic)
        client!.unsubscribe(topic, err => {
          if (err) log("Failed to unsubscribe:", err)
        })
      })
      updates.additions.clear()
      updates.removals.clear()
    }
  }

  return {subscribe}
}

interface Connection {
  subscribe(topic: string, onMessage: MessageCallback): Subscription
}

interface Subscription {
  unsubscribe(): void
}

type MessageCallback = (topic: string, message: any) => void

type ClientFactory = () => MqttClient

type TaskRunner = (task: () => void) => void

type Logger = (...args: any[]) => void
