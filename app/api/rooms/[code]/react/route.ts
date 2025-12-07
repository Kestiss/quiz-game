import { NextRequest, NextResponse } from "next/server";
import { submitReaction } from "@/lib/room-store";
import { jsonError } from "@/lib/api-helpers";
import type { ReactionEmoji } from "@/types/game";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { code } = await context.params;
    const body = await safeJson(request);
    const emoji =
      typeof body.reaction === "string"
        ? (body.reaction as ReactionEmoji)
        : undefined;
    if (!emoji) {
      return NextResponse.json({ error: "reaction is required" }, { status: 400 });
    }
    const reactions = await submitReaction(code, emoji);
    return NextResponse.json({ reactions });
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
