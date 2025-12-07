"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface QRCodeDisplayProps {
    roomCode: string;
    size?: number;
}

export function QRCodeDisplay({ roomCode, size = 100 }: QRCodeDisplayProps) {
    const [joinUrl, setJoinUrl] = useState("");

    useEffect(() => {
        // Get the origin on the client side
        const origin = window.location.origin;
        setJoinUrl(`${origin}?code=${roomCode}`);
    }, [roomCode]);

    if (!joinUrl) {
        // Show placeholder while loading
        return <div style={{ width: size, height: size, background: "rgba(255,255,255,0.1)", borderRadius: 4 }} />;
    }

    return (
        <QRCodeSVG
            value={joinUrl}
            size={size}
            bgColor="transparent"
            fgColor="#ffffff"
            level="M"
        />
    );
}
