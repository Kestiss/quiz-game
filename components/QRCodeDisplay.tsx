"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface QRCodeDisplayProps {
    roomCode: string;
    size?: number;
}

export function QRCodeDisplay({ roomCode, size = 120 }: QRCodeDisplayProps) {
    const [joinUrl, setJoinUrl] = useState("");

    useEffect(() => {
        if (typeof window !== "undefined") {
            const url = new URL("/", window.location.origin);
            url.searchParams.set("join", roomCode);
            setJoinUrl(url.toString());
        }
    }, [roomCode]);

    if (!joinUrl) return null;

    return (
        <div className="qr-code-display">
            <QRCodeSVG
                value={joinUrl}
                size={size}
                bgColor="transparent"
                fgColor="#ffffff"
                level="M"
            />
            <p className="qr-label">Scan to join</p>
        </div>
    );
}
