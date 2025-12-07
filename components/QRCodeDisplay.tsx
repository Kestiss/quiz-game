"use client";

import { useEffect, useState } from "react";
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
        <div className="qr-code-wrapper">
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
