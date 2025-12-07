"use client";

import { QRCodeSVG } from "qrcode.react";

interface QRCodeDisplayProps {
    roomCode: string;
    size?: number;
}

export function QRCodeDisplay({ roomCode, size = 100 }: QRCodeDisplayProps) {
    const joinUrl = typeof window !== "undefined"
        ? `${window.location.origin}?code=${roomCode}`
        : `/?code=${roomCode}`;

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
