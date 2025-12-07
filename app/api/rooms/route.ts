import { NextResponse } from "next/server";
import { createRoom } from "@/lib/room-store";
import { jsonError } from "@/lib/api-helpers";

export async function POST(request: Request) {
  try {
    const body = await safeJson(request);
    const name = typeof body.name === "string" ? body.name : "";
    const rounds =
      typeof body.rounds === "number" ? Number(body.rounds) : undefined;
    const avatar = typeof body.avatar === "string" ? body.avatar : undefined;

    const { room, player } = await createRoom(name, rounds, avatar);
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
