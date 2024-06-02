import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  //const data = await req.json();
  //console.log("data  ", data);

  let data = "Hello from my JS route!";
  console.log(data);

  let headers = {
    "Content-Type": "text/plain",
  }
  return new NextResponse(`${data}`, {status: 220, headers});
}
