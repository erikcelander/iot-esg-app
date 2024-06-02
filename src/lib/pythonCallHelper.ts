import { request as httpsRequest } from "https"
import { cookies, headers } from "next/headers"
import { NextRequest } from "next/server"
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

  // According to the Vercel docs, getting the host name from the client
  // request is the way to do it. The VERCEL_URL variable is deprecated
  // and access gets blocked by the deployment protection feature
  // even with the correct client cookies.
  // https://vercel.com/docs/security/deployment-protection#migrating-to-standard-protection
  let vercelHostname = headers().get("host")

  let url = `https://${vercelHostname}/api/${name}`
  console.log("Python token:", token)
  console.log("Python url:", url)

  let vercelToken = cookies().get("_vercel_jwt")?.value!
  console.log("Hmmmm", vercelToken)

  let response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Cookie": `_vercel_jwt=${vercelToken}`,
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
