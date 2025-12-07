"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function StageEntryPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 4) {
      setError("Enter the 4-letter room code.");
      return;
    }
    router.push(`/stage/${normalized}`);
  };

  return (
    <div className="stage-wrapper theme-neon">
      <div className="stage-overlay" />
      <div className="stage-content">
        <main className="stage-panel">
          <h1>Stage View</h1>
          <p className="muted">
            Enter the room code to mirror the show on your TV or projector.
          </p>
          <form onSubmit={submit} className="form">
            <label>
              Room code
              <input
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setError("");
                }}
                placeholder="ABCD"
                maxLength={4}
                style={{ textTransform: "uppercase" }}
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="primary">
              Enter studio
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
