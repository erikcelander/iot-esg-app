import { describe, it, expect, beforeEach } from "vitest"
import { createMqttConnection } from "../src/lib/mqtt"
import { MqttClient } from "mqtt"

describe("createMqttConnection", () => {
  let clientFactory, fakeRunner, connection

  beforeEach(() => {
    clientFactory = createFakeClientFactory()
    fakeRunner = createFakeRunner()
    connection = createMqttConnection(clientFactory.factory, fakeRunner.runner)
  })

  it("delays connect until first subscription", () => {
    expect(clientFactory.count()).toBe(0)

    connection.subscribe("topic1", () => {})
    expect(clientFactory.count()).toBe(1)

    connection.subscribe("topic2", () => {})
    expect(clientFactory.count()).toBe(1)
  })

  it("subscribes to topics on connect", () => {
    connection.subscribe("topic1", () => {})
    connection.subscribe("topic2", () => {})
    let client = clientFactory.single()
    expect(client.topics).toEqual([])

    client.onConnect()
    expect(client.topics).toEqual(["topic1", "topic2"])
  })

  it("subscribes to new topics when already connected", () => {
    connection.subscribe("topic1", () => {})
    let client = clientFactory.single()
    client.onConnect()

    connection.subscribe("topic2", () => {})
    expect(client.topics).toEqual(["topic1", "topic2"])
  })

  it("unsubscribes from topics when requested", () => {
    connection.subscribe("topic1", () => {})
    let sub = connection.subscribe("topic2", () => {})
    connection.subscribe("topic3", () => {})
    let client = clientFactory.single()
    client.onConnect()

    sub.unsubscribe()
    expect(client.topics).toEqual(["topic1", "topic3"])
  })

  it("subscribes to topic only once with multiple subscribers", () => {
    connection.subscribe("topic1", () => {})
    connection.subscribe("topic1", () => {})
    let client = clientFactory.single()
    client.onConnect()
    expect(client.topics).toEqual(["topic1"])

    connection.subscribe("topic1", () =>  {})
    expect(client.topics).toEqual(["topic1"])
  })

  it("invokes all subscribers when topic message received", () => {
    let received: string[] = []
    connection.subscribe("topic1", () => { received.push("sub1") })
    connection.subscribe("topic1", () => { received.push("sub2") })
    let client = clientFactory.single()
    client.onConnect()
    connection.subscribe("topic1", () => { received.push("sub3") })

    client.onMessage("topic1", "test message")
    expect(received).toEqual(["sub1", "sub2", "sub3"])
  })

  it("invokes subscribers only for subscribed topic", () => {
    let received: string[] = []
    connection.subscribe("topic1", () => { received.push("sub1") })
    connection.subscribe("topic2", () => { received.push("sub2") })
    let client = clientFactory.single()
    client.onConnect()
    connection.subscribe("topic3", () => { received.push("sub3") })
    expect(received).toEqual([])

    client.onMessage("topic1", "test message")
    expect(received).toEqual(["sub1"])

    received.splice(0)
    client.onMessage("topic2", "test message")
    expect(received).toEqual(["sub2"])

    received.splice(0)
    client.onMessage("topic3", "test message")
    expect(received).toEqual(["sub3"])
  })
})

function createFakeClient() {
  let callbacks: any[] = []
  let topics: string[] = []

  let client: any = {
    connected: false,
    disconnecting: false,
    subscribe(topic, callback) {
      //console.log("Dummy subscribe:", topic)
      topics.push(topic)
    },
    unsubscribe(topic, callback) {
      //console.log("Dummy unsubscribe:", topic)
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

  function raiseEvent(eventName: string, ...args: any[]) {
      callbacks
        .filter(([name, func]) => name === eventName)
        .map(([name, func]) => func)
        .forEach(func => func(...args))
  }

  return {
    client,
    callbacks,
    topics,
    onConnect() {
      client.connected = true
      raiseEvent("connect")
    },
    onMessage(topic, message) {
      raiseEvent("message", topic, message)
    },
  }
}

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