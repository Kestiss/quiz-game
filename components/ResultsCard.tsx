"use client";

import { useRef, useCallback } from "react";
import type { PublicRoomState, RoundState } from "@/types/game";

interface ResultsCardProps {
    room: PublicRoomState;
}

export function ResultsCard({ room }: ResultsCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);

    const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];
    const runnerUp = sortedPlayers[1];

    const winningAnswers = room.rounds
        .map((round) => {
            const topSubmission = [...round.submissions].sort(
                (a, b) => b.voters.length - a.voters.length
            )[0];
            if (!topSubmission) return null;
            const author = room.players.find((p) => p.id === topSubmission.playerId);
            return {
                prompt: round.prompt,
                answer: topSubmission.text,
                author: author?.name || "Unknown",
                votes: topSubmission.voters.length,
            };
        })
        .filter(Boolean);

    const handleShare = useCallback(async () => {
        const text = `🎮 Party Prompts Results!\n\n🏆 Winner: ${winner?.name} (${winner?.score} pts)\n🥈 Runner-up: ${runnerUp?.name} (${runnerUp?.score} pts)\n\nPlay at: ${window.location.origin}`;

        if (navigator.share) {
            try {
                await navigator.share({ text });
            } catch {
                await navigator.clipboard.writeText(text);
            }
        } else {
            await navigator.clipboard.writeText(text);
        }
    }, [winner, runnerUp]);

    return (
        <div ref={cardRef} className="results-card">
            <div className="results-header">
                <h2>🎉 Game Over!</h2>
                <p className="muted">Party Prompts</p>
            </div>

            <div className="results-podium">
                {winner && (
                    <div className="podium-winner">
                        <span className="trophy">🏆</span>
                        <span className="podium-avatar">{winner.avatar}</span>
                        <p className="podium-name">{winner.name}</p>
                        <p className="podium-score">{winner.score} pts</p>
                    </div>
                )}
                {runnerUp && (
                    <div className="podium-runner">
                        <span className="medal">🥈</span>
                        <span className="podium-avatar">{runnerUp.avatar}</span>
                        <p className="podium-name">{runnerUp.name}</p>
                        <p className="podium-score">{runnerUp.score} pts</p>
                    </div>
                )}
            </div>

            {winningAnswers.length > 0 && (
                <div className="results-highlights">
                    <h3>Highlight Reel</h3>
                    <ul>
                        {winningAnswers.slice(0, 3).map((item, index) => (
                            <li key={index}>
                                <p className="highlight-prompt">{item?.prompt}</p>
                                <p className="highlight-answer">"{item?.answer}"</p>
                                <p className="highlight-author">— {item?.author}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <button type="button" className="share-button" onClick={handleShare}>
                📤 Share Results
            </button>
        </div>
    );
}
