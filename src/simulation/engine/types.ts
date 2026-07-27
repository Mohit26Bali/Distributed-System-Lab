export type Tick = number;

export interface SimEvent {
  id: string;
  tick: Tick;
  type: string;
  moduleId: string;
  payload: unknown;
}
