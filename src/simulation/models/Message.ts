import type { Tick } from "../engine/types";

export type MessageStatus = "in-flight" | "delivered" | "dropped";

export interface Message {
  id: string;
  from: string;
  to: string;
  sentTick: Tick;
  deliveredTick: Tick;
  status: MessageStatus;
  payload: unknown;
}
