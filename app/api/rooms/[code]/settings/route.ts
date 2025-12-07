import { NextRequest, NextResponse } from "next/server";
import { updateSettings, RoomError } from "@/lib/room-store";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;
        const body = await request.json();
        const { playerId, settings } = body;

        if (!playerId || !settings) {
            return NextResponse.json(
                { error: "playerId and settings are required" },
                { status: 400 }
            );
        }

        const room = await updateSettings(code, playerId, settings);
        return NextResponse.json({ room });
    } catch (error) {
        if (error instanceof RoomError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
