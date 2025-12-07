import { NextRequest, NextResponse } from "next/server";
import { addCustomPrompt, clearCustomPrompts, RoomError } from "@/lib/room-store";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;
        const body = await request.json();
        const { playerId, prompt, action } = body;

        if (!playerId) {
            return NextResponse.json({ error: "playerId is required" }, { status: 400 });
        }

        if (action === "clear") {
            const room = await clearCustomPrompts(code, playerId);
            return NextResponse.json({ room });
        }

        if (!prompt) {
            return NextResponse.json({ error: "prompt is required" }, { status: 400 });
        }

        const room = await addCustomPrompt(code, playerId, prompt);
        return NextResponse.json({ room });
    } catch (error) {
        if (error instanceof RoomError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
