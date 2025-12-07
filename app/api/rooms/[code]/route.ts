import { NextResponse } from "next/server";
import { getRoom } from "@/lib/room-store";
import { jsonError } from "@/lib/api-helpers";

interface Params {
  params: { code: string };
}

export async function GET(_: Request, { params }: Params) {
  try {
    const room = await getRoom(params.code);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    return NextResponse.json({ room });
  } catch (error) {
    return jsonError(error);
  }
}
