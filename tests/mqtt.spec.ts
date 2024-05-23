import { describe, it, expect } from "vitest"
import { createMqttConnection } from "../src/lib/mqtt"
import { MqttClient } from "mqtt"

const token = "valid-token"

describe("getNodeStats", () => {
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

    connection.subscribe("test-topic", () => {})
    let client = clientFactory.single()
    expect(client.topics).toEqual([])

    client.onConnect()
    expect(client.topics).toEqual(["test-topic"])

    console.log(client)

    //expect(clientFactory.single().
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