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

export const NETWORKING_CHALLENGE: ChallengeDefinition = {
  id: "cause-a-drop",
  title: "Challenge: Cause a Drop",
  prompt:
    "Make any message get dropped. You can crash its destination first and send to it, or drop an in-flight message manually — either way counts.",
  isComplete: (events) => events.some((event) => event.type === NETWORK_EVENT_TYPES.MESSAGE_DROPPED),
};
