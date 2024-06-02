import { cookies, headers } from "next/headers"
import { Readable } from "stream"

// If we're running on Vercel, we can't just start Python directly,
// but we can call a serverless function using the Python runtime.
export const callPython = process.env.VERCEL_URL
  ? callVercelServerlessFunction
  : callSubprocess

async function callVercelServerlessFunction(
  name: String,
  inputData: Buffer,
): Promise<Buffer> {
  // Reuse the shared cookie secret as authorization token.
  let token = process.env.SECRET_COOKIE_PASSWORD!

  // According to the Vercel docs, getting the host name from the client
  // request is the way to do it. The VERCEL_URL variable is deprecated
  // and access gets blocked by the deployment protection feature
  // even with the correct client cookies.
  // https://vercel.com/docs/security/deployment-protection#migrating-to-standard-protection
  let vercelHostname = headers().get("host")

  let url = `https://${vercelHostname}/api/${name}`
  console.log("Python function URL:", url)

  let vercelToken = cookies().get("_vercel_jwt")?.value!

  let response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Cookie": `_vercel_jwt=${vercelToken}`,
    },
    body: inputData,
  })

  if (response.status === 200) {
    return Buffer.from(await response.arrayBuffer())
  }
  else {
    throw new Error("Python call failed")
  }
}

async function callSubprocess(
  name: String,
  inputData: Buffer,
): Promise<Buffer> {
    // Must be imported dynamically because the module module might be
    // imported by the middleware (among other things) which Next.js wants
    // to run on the edge runtime, which doesn't support this API.
    let spawn = (await import("child_process")).spawn

    let execArgs = [`./api/${name}.py`]
    let options: any = {
      stdio: ["pipe", "pipe", "inherit"],
    }
    let proc = spawn("python3", execArgs, options)

    let inputBlob = new Blob([inputData])
    let inputStream = Readable.fromWeb(inputBlob.stream() as any)
    inputStream.pipe(proc.stdin)

    const outputChunks = []
    for await (let chunk of proc.stdout) {
      outputChunks.push(chunk)
    }
    return Buffer.concat(outputChunks)
}
