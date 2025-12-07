"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactionEmoji } from "@/types/game";

interface FloatingReaction {
    id: string;
    emoji: ReactionEmoji;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    rotation: number;
}

interface FloatingReactionsProps {
    reactions: Record<ReactionEmoji, number>;
}

// Generate random spawn positions from different areas of the screen
function getRandomSpawnPosition(): { startX: number; startY: number; endX: number; endY: number } {
    const edge = Math.floor(Math.random() * 4); // 0: bottom, 1: left, 2: right, 3: corners

    switch (edge) {
        case 0: // Bottom edge - float up
            return {
                startX: 10 + Math.random() * 80,
                startY: 100,
                endX: 10 + Math.random() * 80,
                endY: -20,
            };
        case 1: // Left edge - float right and up
            return {
                startX: -5,
                startY: 30 + Math.random() * 50,
                endX: 30 + Math.random() * 20,
                endY: -10 + Math.random() * 30,
            };
        case 2: // Right edge - float left and up
            return {
                startX: 105,
                startY: 30 + Math.random() * 50,
                endX: 50 + Math.random() * 20,
                endY: -10 + Math.random() * 30,
            };
        case 3: // Random corners
        default:
            const isLeft = Math.random() > 0.5;
            return {
                startX: isLeft ? 5 + Math.random() * 15 : 80 + Math.random() * 15,
                startY: 70 + Math.random() * 20,
                endX: 30 + Math.random() * 40,
                endY: 10 + Math.random() * 30,
            };
    }
}

export function FloatingReactions({ reactions }: FloatingReactionsProps) {
    const [floaters, setFloaters] = useState<FloatingReaction[]>([]);
    const [prevReactions, setPrevReactions] = useState<Record<ReactionEmoji, number>>(reactions);

    useEffect(() => {
        const newFloaters: FloatingReaction[] = [];

        (Object.keys(reactions) as ReactionEmoji[]).forEach((emoji) => {
            const diff = reactions[emoji] - (prevReactions[emoji] || 0);
            if (diff > 0) {
                for (let i = 0; i < Math.min(diff, 5); i++) {
                    const pos = getRandomSpawnPosition();
                    newFloaters.push({
                        id: `${Date.now()}-${emoji}-${i}-${Math.random()}`,
                        emoji,
                        ...pos,
                        rotation: -30 + Math.random() * 60,
                    });
                }
            }
        });

        if (newFloaters.length > 0) {
            setFloaters((prev) => [...prev, ...newFloaters]);
            setTimeout(() => {
                setFloaters((prev) => prev.filter((f) => !newFloaters.some((n) => n.id === f.id)));
            }, 2500);
        }

        setPrevReactions(reactions);
    }, [reactions, prevReactions]);

    return (
        <div className="floating-reactions-container">
            <AnimatePresence>
                {floaters.map((floater) => (
                    <motion.div
                        key={floater.id}
                        className="floating-reaction"
                        style={{ left: `${floater.startX}%`, top: `${floater.startY}%` }}
                        initial={{ opacity: 1, scale: 0.5, rotate: 0 }}
                        animate={{
                            opacity: 0,
                            x: `${floater.endX - floater.startX}vw`,
                            y: `${floater.endY - floater.startY}vh`,
                            scale: 1.8,
                            rotate: floater.rotation,
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2.5, ease: "easeOut" }}
                    >
                        {floater.emoji}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

interface ScoreChangeProps {
    playerId: string;
    amount: number;
    onComplete: () => void;
}

export function ScoreChangeIndicator({ playerId, amount, onComplete }: ScoreChangeProps) {
    useEffect(() => {
        const timer = setTimeout(onComplete, 1500);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <motion.span
            className="score-change"
            initial={{ opacity: 1, y: 0, scale: 0.8 }}
            animate={{ opacity: 0, y: -30, scale: 1.2 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
        >
            +{amount}
        </motion.span>
    );
}
