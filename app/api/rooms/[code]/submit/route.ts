import { NextResponse } from "next/server";
import { submitResponse } from "@/lib/room-store";
import { jsonError } from "@/lib/api-helpers";

interface Params {
  params: { code: string };
}

export async function POST(request: Request, { params }: Params) {
  try {
    const body = await safeJson(request);
    const playerId =
      typeof body.playerId === "string" ? body.playerId : undefined;
    const text = typeof body.text === "string" ? body.text : "";

    if (!playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 });
    }

    const room = await submitResponse(params.code, playerId, text);
    return NextResponse.json({ room });
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
