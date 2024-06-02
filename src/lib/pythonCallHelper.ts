import { request } from "https"
import { cookies } from "next/headers"
import { promisify } from "util"

// If we're running on Vercel, we can't just start Python directly,
// but we can call a serverless function using the Python runtime.
export const callPython = process.env.VERCEL_URL
  ? callVercelServerlessFunction
  : callSubprocess

async function callVercelServerlessFunction(name: String): Promise<Buffer> {
  // Reuse the shared cookie secret as authorization token.
  //let token = process.env.SECRET_COOKIE_PASSWORD!
  let token = "dummy-tok"

  //let url = `https://${process.env.VERCEL_URL}/api/${name}`
  let url = "https://esgauthtest.requestcatcher.com/"
  console.log("Python token:", token)
  console.log("Python url:", url)

  //let response = await request(url, {})

  //let vercelToken = cookies().get("_vercel_jwt")?.value!
  let vercelToken = cookies().get("_dummy")?.value!
  console.log("Hmmmm", vercelToken)

  let response = await fetch(url, {
    method: "POST",
    headers: {
      //Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Cookie": `_vercel_jwt=${vercelToken}`,
      "Sec-Fetch-Mode": "navigate",
    },
  })

  if (response.status === 200) {
    return Buffer.from(await response.arrayBuffer())
  }
  else {
    throw new Error("Python call failed")
  }
}

async function callSubprocess(name: String): Promise<Buffer> {
    // Must be imported dynamically because the module module might be
    // imported by the middleware (among other things) which Next.js wants
    // to run on the edge runtime, which doesn't support this API.
    let execFile = promisify((await import("child_process")).execFile)

    let args = [`./api/${name}.py`]
    let options = {
      maxBuffer: 16384 * 1024,
      encoding: "buffer",
    }
    let { stdout, stderr } = await execFile("python3", args, options)
    console.log("stderr:", stderr)

    return stdout as unknown as Buffer
}
