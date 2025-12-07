"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactionEmoji } from "@/types/game";

interface FloatingReaction {
    id: string;
    emoji: ReactionEmoji;
    x: number;
}

interface FloatingReactionsProps {
    reactions: Record<ReactionEmoji, number>;
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
                    newFloaters.push({
                        id: `${Date.now()}-${emoji}-${i}`,
                        emoji,
                        x: 20 + Math.random() * 60,
                    });
                }
            }
        });

        if (newFloaters.length > 0) {
            setFloaters((prev) => [...prev, ...newFloaters]);
            setTimeout(() => {
                setFloaters((prev) => prev.filter((f) => !newFloaters.some((n) => n.id === f.id)));
            }, 2000);
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
                        initial={{ opacity: 1, y: 0, x: `${floater.x}%`, scale: 1 }}
                        animate={{ opacity: 0, y: -200, scale: 1.5 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2, ease: "easeOut" }}
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
