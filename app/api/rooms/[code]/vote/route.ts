import { NextRequest, NextResponse } from "next/server";
import { submitVote } from "@/lib/room-store";
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
    const submissionId =
      typeof body.submissionId === "string" ? body.submissionId : undefined;

    if (!playerId || !submissionId) {
      return NextResponse.json(
        { error: "playerId and submissionId are required" },
        { status: 400 },
      );
    }

    const room = await submitVote(code, playerId, submissionId);
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
