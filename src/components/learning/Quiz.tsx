"use client";

import { useState } from "react";

import type { PredictiveQuizDefinition } from "@/store/quiz";
import { useSimulationStore } from "@/store/simulationStore";

interface QuizProps {
  quiz: PredictiveQuizDefinition;
}

export function Quiz({ quiz }: QuizProps) {
  const events = useSimulationStore((state) => state.events);

  const [guess, setGuess] = useState<string | null>(null);
  // events.length at the moment the guess was made -- resolveOutcome must
  // only ever see what happens AFTER the prediction, never a fact that
  // already committed earlier in the session.
  const [guessedAtCount, setGuessedAtCount] = useState(0);

  function pickGuess(optionId: string) {
    setGuess(optionId);
    setGuessedAtCount(events.length);
  }

  function tryAgain() {
    setGuess(null);
    setGuessedAtCount(events.length);
  }

  const outcome = guess ? quiz.resolveOutcome(events.slice(guessedAtCount)) : undefined;

  return (
    <div className="space-y-2 rounded border border-border-subtle bg-bg-elevated p-3">
      <p className="text-xs font-medium text-text-secondary">Quiz</p>
      <p className="text-sm text-text-primary">{quiz.question}</p>

      {!guess && (
        <div className="flex flex-wrap gap-2">
          {quiz.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => pickGuess(option.id)}
              className="rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs text-text-primary hover:bg-bg-canvas"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {guess && outcome === undefined && (
        <p className="text-xs text-text-muted">Waiting to see what actually happens…</p>
      )}

      {guess && outcome !== undefined && (
        <div className="space-y-2">
          <p className={`text-xs ${outcome === guess ? "text-emerald-400" : "text-red-400"}`}>
            {outcome === guess ? "Correct." : "Not quite."} The message was {outcome}.
          </p>
          <button
            type="button"
            onClick={tryAgain}
            className="rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs text-text-primary hover:bg-bg-canvas"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
