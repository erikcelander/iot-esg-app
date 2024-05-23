import { describe, it, expect } from "vitest"
import { createMqttConnection } from "../src/lib/mqtt"
import { MqttClient } from "mqtt"

const token = "valid-token"

describe("createMqttConnection", () => {
  it("delays connect until first subscription", () => {
    let clientFactory = createFakeClientFactory()
    let fakeRunner = createFakeRunner()

    let connection = createMqttConnection(clientFactory.factory, fakeRunner.runner)
    expect(clientFactory.count()).toBe(0)

    connection.subscribe("topic1", () => {})
    expect(clientFactory.count()).toBe(1)

    connection.subscribe("topic2", () => {})
    expect(clientFactory.count()).toBe(1)
  })

  it("subscribes to topics on connect", () => {
    let clientFactory = createFakeClientFactory()
    let fakeRunner = createFakeRunner()
    let connection = createMqttConnection(clientFactory.factory, fakeRunner.runner)

    connection.subscribe("topic1", () => {})
    connection.subscribe("topic2", () => {})
    let client = clientFactory.single()
    expect(client.topics).toEqual([])

    client.onConnect()
    expect(client.topics).toEqual(["topic1", "topic2"])
  })

  it("subscribes to new topics when already connected", () => {
    let clientFactory = createFakeClientFactory()
    let fakeRunner = createFakeRunner()
    let connection = createMqttConnection(clientFactory.factory, fakeRunner.runner)

    connection.subscribe("topic1", () => {})
    let client = clientFactory.single()
    client.onConnect()

    connection.subscribe("topic2", () => {})
    expect(client.topics).toEqual(["topic1", "topic2"])
  })

  it("unsubscribes from topics when requested", () => {
    let clientFactory = createFakeClientFactory()
    let fakeRunner = createFakeRunner()
    let connection = createMqttConnection(clientFactory.factory, fakeRunner.runner)

    connection.subscribe("topic1", () => {})
    let subscription = connection.subscribe("topic2", () => {})
    connection.subscribe("topic3", () => {})
    let client = clientFactory.single()
    client.onConnect()

    subscription.unsubscribe()
    expect(client.topics).toEqual(["topic1", "topic3"])
  })
})

function createFakeClientFactory() {
  let clients: any[] = []
  return {
    count() {
      return clients.length
    },
    single() {
      if (clients.length !== 1)
        throw new Error("Wrong client count: " + clients.length)
      return clients[clients.length - 1]
    },
    factory(): MqttClient {
      let client: any = createFakeClient()
      clients.push(client)
      return client.client
    }
  }
}

function createFakeClient() {
  let callbacks: any[] = []
  let topics: string[] = []

  let client: any = {
    connected: false,
    disconnecting: false,
    subscribe(topic, callback) {
      console.log("Dummy subscribe:", topic)
      topics.push(topic)
    },
    unsubscribe(topic, callback) {
      console.log("Dummy unsubscribe:", topic)
      let index = topics.indexOf(topic)
      if (index !== -1) {
        topics.splice(index, 1)
      }
      else {
        throw new Error(`Not subscribed to topic: ${topic}`)
      }
    },
    on(eventName: string, callback) {
      callbacks.push([eventName, callback])
    }
  }

  return {
    client,
    callbacks,
    topics,
    onConnect() {
      client.connected = true
      callbacks
        .filter(([eventName, func]) => eventName === "connect")
        .map(([eventName, func]) => func)
        .forEach(func => func())
    }
  }
}

function createFakeRunner() {
  let tasks: (() => void)[] = [];
  return {
    runner(task: () => void) {
      tasks.push(task)
    },
    run() {
      while (tasks.length) {
        let [task] = tasks.splice(0, 1)
        console.log("Task:", task)
        task()
      }
    }
  }
}