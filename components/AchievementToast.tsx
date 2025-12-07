"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type AchievementType =
    | "first-answer"
    | "crowd-favorite"
    | "underdog"
    | "streak-2"
    | "streak-3"
    | "unanimous";

interface Achievement {
    id: string;
    type: AchievementType;
    playerName: string;
}

const ACHIEVEMENT_CONFIG: Record<AchievementType, { icon: string; title: string; description: string }> = {
    "first-answer": {
        icon: "⚡",
        title: "Speed Demon",
        description: "First to submit an answer!",
    },
    "crowd-favorite": {
        icon: "⭐",
        title: "Crowd Favorite",
        description: "Most votes this round!",
    },
    "underdog": {
        icon: "🐕",
        title: "Underdog Victory",
        description: "Won despite being behind!",
    },
    "streak-2": {
        icon: "🔥",
        title: "On Fire",
        description: "2 wins in a row!",
    },
    "streak-3": {
        icon: "🌟",
        title: "Unstoppable",
        description: "3 wins in a row!",
    },
    "unanimous": {
        icon: "👑",
        title: "Unanimous Winner",
        description: "Everyone voted for you!",
    },
};

interface AchievementToastProps {
    achievement: Achievement;
    onDismiss: () => void;
}

export function AchievementToast({ achievement, onDismiss }: AchievementToastProps) {
    const config = ACHIEVEMENT_CONFIG[achievement.type];

    useEffect(() => {
        const timer = setTimeout(onDismiss, 4000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <motion.div
            className="achievement-toast"
            initial={{ opacity: 0, y: 50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
            <span className="achievement-icon">{config.icon}</span>
            <div className="achievement-content">
                <p className="achievement-title">{config.title}</p>
                <p className="achievement-desc">
                    {achievement.playerName}: {config.description}
                </p>
            </div>
        </motion.div>
    );
}

interface AchievementContainerProps {
    achievements: Achievement[];
    onDismiss: (id: string) => void;
}

export function AchievementContainer({ achievements, onDismiss }: AchievementContainerProps) {
    return (
        <div className="achievement-container">
            <AnimatePresence>
                {achievements.map((achievement) => (
                    <AchievementToast
                        key={achievement.id}
                        achievement={achievement}
                        onDismiss={() => onDismiss(achievement.id)}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
}
