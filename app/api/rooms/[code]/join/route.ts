import { NextResponse } from "next/server";
import { joinRoom } from "@/lib/room-store";
import { jsonError } from "@/lib/api-helpers";

interface Params {
  params: { code: string };
}

export async function POST(request: Request, { params }: Params) {
  try {
    const body = await safeJson(request);
    const name = typeof body.name === "string" ? body.name : "";

    const { room, player } = await joinRoom(params.code, name);
    return NextResponse.json({ room, player });
  } catch (error) {
    return jsonError(error);
  }
}

async function safeJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
