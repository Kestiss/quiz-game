import { NextRequest, NextResponse } from "next/server";
import { setTheme } from "@/lib/room-store";
import { jsonError } from "@/lib/api-helpers";
import type { ThemeName } from "@/types/game";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { code } = await context.params;
    const body = await safeJson(request);
    const playerId =
      typeof body.playerId === "string" ? body.playerId : undefined;
    const theme =
      typeof body.theme === "string" ? (body.theme as ThemeName) : undefined;
    if (!playerId || !theme) {
      return NextResponse.json(
        { error: "playerId and theme are required" },
        { status: 400 },
      );
    }
    const room = await setTheme(code, playerId, theme);
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
