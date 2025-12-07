import { NextRequest, NextResponse } from "next/server";
import { getRoom } from "@/lib/room-store";
import { jsonError } from "@/lib/api-helpers";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function GET(_: NextRequest, context: RouteContext) {
  try {
    const { code } = await context.params;
    const room = await getRoom(code);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    return NextResponse.json({ room });
  } catch (error) {
    return jsonError(error);
  }
}
