import { describe, it, expect } from "vitest"
import { createMqttConnection } from "../src/lib/mqtt"
import { MqttClient } from "mqtt"

const token = "valid-token"

describe("getNodeStats", () => {
  it("delays connect until first subscription", async () => {
    let clientFactory = createFakeClientFactory()
    let fakeRunner = createFakeRunner()

    let connection = createMqttConnection(clientFactory.factory, fakeRunner.runner)
    expect(clientFactory.count()).toBe(0)

    connection.subscribe("test-topic", () => { console.log("Got message.") })
    expect(clientFactory.count()).toBe(1)

    // let fakeClient = clientFactory.single()
    // console.log(fakeClient.callbacks)
    // fakeClient.onConnect()
    // fakeRunner.run()

    //let result = 1 + 1
    //let expected = 2
    //expect(result).toEqual(expected)
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
        throw new Error("client count: " + clients.length)
      return clients[clients.length - 1]
    },
    factory(): MqttClient {
      console.log("Fake factory making client!")
      let client: any = createFakeClient()
      clients.push(client)
      return client
    }
  }
}

function createFakeClient() {
  let callbacks: any[] = [];

  let client: any = {
    subscribe() {
      console.log("Dummy subscribe!")
    },
    unsubscribe() {
      console.log("Dummy unsubscribe!")
    },
    on(eventName: string, callback) {
      callbacks.push([eventName, callback])
    }
  }

  return {
    client,
    callbacks,
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