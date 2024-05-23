import { describe, it, expect } from "vitest"
import { createMqttConnection } from "../src/lib/mqtt"

const token = "valid-token"

describe("getNodeStats", () => {
  it("does as thing", async () => {

    let fakeClient = createFakeClient()
    let fakeRunner = createFakeRunner()

    let connection = createMqttConnection(() => fakeClient.client, fakeRunner.runner)
    connection.subscribe("test-topic", () => { console.log("Got message.") })

    console.log(fakeClient.callbacks)
    fakeClient.onConnect()
    fakeRunner.run()

    //let result = 1 + 1
    //let expected = 2
    //expect(result).toEqual(expected)
  })
})

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