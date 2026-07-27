import type { Tick } from "../engine/types";

// "dropped" arrives with fault injection in Milestone 9.
export type MessageStatus = "in-flight" | "delivered";

export interface Message {
  id: string;
  from: string;
  to: string;
  sentTick: Tick;
  deliveredTick: Tick;
  status: MessageStatus;
  payload: unknown;
}
