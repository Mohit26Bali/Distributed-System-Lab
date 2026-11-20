import {
  Compass,
  Crown,
  Database,
  Network,
  Copy,
  Equal,
  Ship,
  Split,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Difficulty = "Beginner" | "Intermediate" | "Advanced";

export interface LandingModuleMeta {
  icon: LucideIcon;
  /** A hex accent color, applied via CSS custom property — never as a
   * dynamically-built Tailwind class name (which the JIT scanner can't
   * see), always through `style={{ "--accent": color }}` plus a static
   * `var(--accent)` arbitrary-value utility. */
  color: string;
  difficulty: Difficulty;
  minutes: number;
}

/** Landing-page-only presentation metadata, deliberately kept separate
 * from ModuleDefinition (moduleRegistry.tsx) — icon/color/difficulty/time
 * estimates are a landing page concern, not something the simulation
 * engine or any module's own content needs to know about. */
export const LANDING_MODULE_META: Record<string, LandingModuleMeta> = {
  introduction: { icon: Compass, color: "#8fb8a0", difficulty: "Beginner", minutes: 5 },
  networking: { icon: Network, color: "#3dff8a", difficulty: "Beginner", minutes: 15 },
  replication: { icon: Copy, color: "#38e1ff", difficulty: "Beginner", minutes: 15 },
  consistency: { icon: Equal, color: "#2ee6c0", difficulty: "Intermediate", minutes: 15 },
  cap: { icon: Split, color: "#ffa14a", difficulty: "Intermediate", minutes: 10 },
  quorum: { icon: Users, color: "#7fb2ff", difficulty: "Intermediate", minutes: 15 },
  election: { icon: Crown, color: "#ffd23f", difficulty: "Intermediate", minutes: 15 },
  raft: { icon: Ship, color: "#ff6ad5", difficulty: "Advanced", minutes: 25 },
  "fault-injection": { icon: TriangleAlert, color: "#ff5c5c", difficulty: "Advanced", minutes: 15 },
  "distributed-database": { icon: Database, color: "#b6ff5c", difficulty: "Advanced", minutes: 20 },
};

/** The roadmap's documented teaching/dependency order (docs/08-module-
 * roadmap.md) — the order modules were designed to be learned in, which
 * differs from the order they were actually built in. Drives the
 * Learning Path section and the module grid below it. */
export const LEARNING_PATH_ORDER = [
  "introduction",
  "networking",
  "replication",
  "consistency",
  "cap",
  "quorum",
  "election",
  "raft",
  "fault-injection",
  "distributed-database",
];

/** Groups the same ids into the three natural tiers the roadmap's own
 * dependency order falls into (docs/08-module-roadmap.md) — used to group
 * the module grid into a collapsible accordion instead of one flat list. */
export const LEARNING_PATH_GROUPS = [
  { label: "Foundations", ids: ["introduction", "networking", "replication"] },
  { label: "Consistency & Correctness", ids: ["consistency", "cap", "quorum"] },
  { label: "Consensus & Composition", ids: ["election", "raft", "fault-injection", "distributed-database"] },
];
