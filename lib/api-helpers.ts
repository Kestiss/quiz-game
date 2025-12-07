import { NextResponse } from "next/server";
import { RoomError } from "./room-store";

export function jsonError(error: unknown) {
  if (error instanceof RoomError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
