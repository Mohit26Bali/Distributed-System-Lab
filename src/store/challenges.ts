import type { SimEvent } from "@/simulation/engine/types";
import { NETWORK_EVENT_TYPES } from "@/simulation/events/networkEvents";

export interface ChallengeDefinition {
  id: string;
  title: string;
  prompt: string;
  /**
   * Checked against the WHOLE session log, unlike guided steps' windowed
   * checks — a challenge asks "can you make this true," not "did you just
   * do the specific thing I instructed," so an earlier occurrence (even
   * from an unrelated guided step) legitimately counts. Accepts any valid
   * path to the outcome, never a specific click sequence.
   */
  isComplete: (events: readonly SimEvent[]) => boolean;
}

export const NETWORKING_CHALLENGES: ChallengeDefinition[] = [
  {
    id: "cause-a-drop",
    title: "Challenge: Cause a Drop",
    prompt:
      "Make any message get dropped. Crash its destination and send to it, partition it away, set the drop rate high, or drop it manually — any of those count.",
    isComplete: (events) =>
      events.some((event) => event.type === NETWORK_EVENT_TYPES.MESSAGE_DROPPED),
  },
  {
    id: "cause-a-duplicate",
    title: "Challenge: Cause a Duplicate",
    prompt: "Make a message arrive twice, using the Duplicate fault.",
    isComplete: (events) =>
      events.some((event) => event.type === NETWORK_EVENT_TYPES.MESSAGE_DUPLICATED),
  },
];
