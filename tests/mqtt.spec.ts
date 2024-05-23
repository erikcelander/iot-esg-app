import { describe, it, expect, beforeEach } from "vitest"
import { createMqttConnection } from "../src/lib/mqtt"
import { MqttClient } from "mqtt"

describe("createMqttConnection", () => {
  let clientFactory, taskRunner, connection

  beforeEach(() => {
    taskRunner = createFakeTaskRunner()
    clientFactory = createFakeClientFactory(taskRunner)
    connection = createMqttConnection(
      clientFactory.factory,
      taskRunner.runner,
      () => {})
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
    expect(client.calls).toEqual([])

    client.onConnect()
    expect(client.calls).toEqual(["+topic1", "+topic2", "+topic3"])

    sub.unsubscribe()
    expect(client.calls).toEqual(["+topic1", "+topic2", "+topic3", "-topic2"])
    expect(client.topics).toEqual(["topic1", "topic3"])
  })

  it("unsubscribes only if subscribed", () => {
    let sub1 = connection.subscribe("topic1", () => {})
    let sub2 = connection.subscribe("topic2", () => {})
    let client = clientFactory.single()
    sub1.unsubscribe()
    client.onConnect()
    sub2.unsubscribe()
    sub2.unsubscribe()
    expect(client.calls).toEqual(["+topic2", "-topic2"])
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
    let received: any[][] = []
    let bindCallback = (name: string) =>
      (...args: any[]) => { received.push([name, ...args]) }

    connection.subscribe("topic1", bindCallback("sub1"))
    connection.subscribe("topic1", bindCallback("sub2"))
    let client = clientFactory.single()
    client.onConnect()
    connection.subscribe("topic1", bindCallback("sub3"))

    client.onMessage("topic1", "msg")
    expect(received).toEqual([
      ["sub1", "topic1", "msg"],
      ["sub2", "topic1", "msg"],
      ["sub3", "topic1", "msg"]])
  })

  it("invokes subscribers only for subscribed topic", () => {
    let received: any[][] = []
    let bindCallback = (name: string) =>
      (...args: any[]) => { received.push([name, ...args]) }

    connection.subscribe("topic1", bindCallback("sub1"))
    connection.subscribe("topic2", bindCallback("sub2"))
    let client = clientFactory.single()
    client.onConnect()
    connection.subscribe("topic3", bindCallback("sub3"))
    expect(received).toEqual([])

    client.onMessage("topic1", "msg1")
    expect(received).toEqual([["sub1", "topic1", "msg1"]])

    received.splice(0)
    client.onMessage("topic2", "msg2")
    expect(received).toEqual([["sub2", "topic2", "msg2"]])

    received.splice(0)
    client.onMessage("topic3", "msg3")
    expect(received).toEqual([["sub3", "topic3", "msg3"]])
  })

  it("unsubscribes client when last subscriber removed from topic", () => {
    let sub1 = connection.subscribe("topic1", () => {})
    let sub2 = connection.subscribe("topic1", () => {})
    connection.subscribe("topic2", () => {})
    let client = clientFactory.single()
    client.onConnect()
    let sub3 = connection.subscribe("topic1", () => {})
    expect(client.topics).toEqual(["topic1", "topic2"])

    sub1.unsubscribe()
    expect(client.topics).toEqual(["topic1", "topic2"])

    sub2.unsubscribe()
    expect(client.topics).toEqual(["topic1", "topic2"])

    sub3.unsubscribe()
    expect(client.topics).toEqual(["topic2"])
  })

  it("coalesces subscription changes", () => {
    connection.subscribe("topic1", () => {})
    let sub2 = connection.subscribe("topic2", () => {})
    let client = clientFactory.single()
    sub2.unsubscribe()

    client.onConnect()
    expect(client.calls).toEqual(["+topic1"])

    taskRunner.pause()
    connection.subscribe("topic3", () => {})
    let sub4 = connection.subscribe("topic4", () => {})
    let sub5 = connection.subscribe("topic5", () => {})
    connection.subscribe("topic5", () => {})
    sub4.unsubscribe()
    sub5.unsubscribe()
    taskRunner.continue()
    expect(client.calls).toEqual(["+topic1", "+topic3", "+topic5"])
  })
})

function createFakeClient(taskRunner) {
  let callbacks: any[] = []
  let topics: string[] = []
  let calls: string[] = []

  let client: any = {
    connected: false,
    disconnecting: false,
    subscribe(topic, callback) {
      //console.log("Dummy subscribe:", topic)
      calls.push(`+${topic}`)
      topics.push(topic)
    },
    unsubscribe(topic, callback) {
      //console.log("Dummy unsubscribe:", topic)
      calls.push(`-${topic}`)
      let index = topics.indexOf(topic)
      if (index !== -1) {
        topics.splice(index, 1)
      }
    },
    on(eventName: string, callback) {
      callbacks.push([eventName, callback])
    }
  }

  function raiseEvent(eventName: string, ...args: any[]) {
    taskRunner.run()
    callbacks
      .filter(([name, func]) => name === eventName)
      .map(([name, func]) => func)
      .forEach(func => func(...args))
    taskRunner.run()
  }

  return {
    client,
    callbacks,
    topics,
    calls,
    onConnect() {
      client.connected = true
      raiseEvent("connect")
    },
    onMessage(topic, message) {
      raiseEvent("message", topic, message)
    },
  }
}

function createFakeClientFactory(taskRunner) {
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
      let client: any = createFakeClient(taskRunner)
      clients.push(client)
      return client.client
    }
  }
}

function createFakeTaskRunner() {
  let tasks: (() => void)[] = []
  let isPaused = false

  function run() {
    while (tasks.length) {
      let [task] = tasks.splice(0, 1)
      task()
    }
  }

  return {
    runner(task: () => void) {
      tasks.push(task)
      if (!isPaused) {
        run()
      }
    },
    pause() {
      isPaused = true
    },
    continue() {
      isPaused = false
      run()
    },
    run,
  }
}