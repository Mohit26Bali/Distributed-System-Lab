import type { SimEvent } from "@/simulation/engine/types";
import { NETWORK_EVENT_TYPES } from "@/simulation/events/networkEvents";

export interface QuizOption {
  id: string;
  label: string;
}

export interface PredictiveQuizDefinition {
  id: string;
  question: string;
  options: QuizOption[];
  /**
   * Returns the actual outcome's option id once a relevant fact has
   * committed since the guess was made, or undefined if not resolved yet.
   * Only ever given events since the guess (see Quiz.tsx) — a fact that
   * committed before the prediction was made must never resolve it.
   */
  resolveOutcome: (eventsSinceGuess: readonly SimEvent[]) => string | undefined;
}

export const NETWORKING_QUIZ: PredictiveQuizDefinition = {
  id: "delivered-or-dropped",
  question:
    'Kill node B in the fault menu, then send another ping to it. What happens to that message?',
  options: [
    { id: "delivered", label: "It will still be delivered" },
    { id: "dropped", label: "It will be dropped" },
  ],
  resolveOutcome: (events) => {
    for (const event of events) {
      if (event.type === NETWORK_EVENT_TYPES.MESSAGE_DELIVERED) return "delivered";
      if (event.type === NETWORK_EVENT_TYPES.MESSAGE_DROPPED) return "dropped";
    }
    return undefined;
  },
};
