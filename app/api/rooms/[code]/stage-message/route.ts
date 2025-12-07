import { NextRequest, NextResponse } from "next/server";
import { sendStageMessage } from "@/lib/room-store";
import { jsonError } from "@/lib/api-helpers";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { code } = await context.params;
    const body = await safeJson(request);
    const playerId =
      typeof body.playerId === "string" ? body.playerId : undefined;
    const text = typeof body.text === "string" ? body.text : "";
    const kind =
      body.kind === "intermission" ? "intermission" : ("teleprompter" as const);
    const durationMs =
      typeof body.durationMs === "number" ? Number(body.durationMs) : undefined;

    if (!playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 });
    }

    const stageMessage = await sendStageMessage(code, playerId, {
      kind,
      text,
      durationMs,
    });
    return NextResponse.json({ stageMessage });
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
