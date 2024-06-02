import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  //const data = await req.json();
  //console.log("data  ", data);

  let data = "Hello from my JS route!";

  return new NextResponse(`${data}`);
}
