"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";

interface CountdownTimerProps {
    deadline: number;
    warningThreshold?: number;
    onComplete?: () => void;
    onWarning?: () => void;
    size?: "small" | "medium" | "large";
    showSeconds?: boolean;
}

export function CountdownTimer({
    deadline,
    warningThreshold = 10,
    onComplete,
    onWarning,
    size = "medium",
    showSeconds = true,
}: CountdownTimerProps) {
    const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    const [isWarning, setIsWarning] = useState(false);
    const [hasWarned, setHasWarned] = useState(false);
    const [hasCompleted, setHasCompleted] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000));
            setRemaining(secondsLeft);

            if (secondsLeft <= warningThreshold && !hasWarned) {
                setIsWarning(true);
                setHasWarned(true);
                onWarning?.();
            }

            if (secondsLeft === 0 && !hasCompleted) {
                setHasCompleted(true);
                onComplete?.();
                clearInterval(interval);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [deadline, warningThreshold, onComplete, onWarning, hasWarned, hasCompleted]);

    const totalDuration = Math.max(1, Math.ceil((deadline - Date.now()) / 1000) + remaining);
    const progress = remaining / totalDuration;

    const sizeClasses = {
        small: "countdown-timer-small",
        medium: "countdown-timer-medium",
        large: "countdown-timer-large",
    };

    return (
        <div className={`countdown-timer ${sizeClasses[size]} ${isWarning ? "warning" : ""}`}>
            <svg viewBox="0 0 100 100" className="countdown-ring">
                <circle
                    className="countdown-bg"
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    strokeWidth="8"
                />
                <motion.circle
                    className="countdown-progress"
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={283}
                    strokeDashoffset={283 * (1 - progress)}
                    initial={false}
                    animate={{ strokeDashoffset: 283 * (1 - progress) }}
                    transition={{ duration: 0.1 }}
                />
            </svg>
            {showSeconds && (
                <motion.span
                    className="countdown-text"
                    animate={isWarning ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 0.5 }}
                >
                    {remaining}
                </motion.span>
            )}
        </div>
    );
}

interface TimerBarProps {
    deadline: number;
    warningThreshold?: number;
}

export function TimerBar({ deadline, warningThreshold = 10 }: TimerBarProps) {
    const [progress, setProgress] = useState(1);
    const [isWarning, setIsWarning] = useState(false);
    const [initialDuration] = useState(() => Math.max(1, deadline - Date.now()));

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, deadline - now);
            const newProgress = remaining / initialDuration;
            setProgress(newProgress);

            const secondsLeft = remaining / 1000;
            setIsWarning(secondsLeft <= warningThreshold);
        }, 100);

        return () => clearInterval(interval);
    }, [deadline, initialDuration, warningThreshold]);

    return (
        <div className={`timer-bar ${isWarning ? "warning" : ""}`}>
            <motion.div
                className="timer-bar-fill"
                initial={false}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.1 }}
            />
        </div>
    );
}
