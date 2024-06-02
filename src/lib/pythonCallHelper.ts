import { promisify } from "util";

// If we're running on Vercel, we can't just start Python directly,
// but we can call a serverless function using the Python runtime.
export const callPython = process.env.VERCEL_URL
  ? callVercelServerlessFunction
  : callSubprocess

async function callVercelServerlessFunction(name: String): Promise<Buffer> {
  // Reuse the shared cookie secret as authorization token.
  let token = process.env.SECRET_COOKIE_PASSWORD!

  let url = `https://${process.env.VERCEL_URL}/api/${name}`
  let response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
  })

  return Buffer.from(await response.arrayBuffer())
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
    console.log("stdout:", stdout)
    console.log("stderr:", stderr)

    return stdout as unknown as Buffer
}
