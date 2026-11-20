"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { HelpCircle, X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A per-module reference doc, opened on demand — distinct from GuidedStep's
 * "do this now, in order" flow. Theory is something you look up any time,
 * not a progression the learner is walked through. Ported from a sibling
 * project's identical pattern; see docs note in NetworkingTheory.tsx for
 * the one real adaptation this project's open-ended (not scripted) sims
 * required.
 */
export function TheoryDialog({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          aria-label="Module theory and explanation"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-subtle text-text-muted transition hover:border-purple-400/50 hover:text-purple-400"
        >
          <HelpCircle size={16} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="glass fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[min(640px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Dialog.Title className="text-sm font-semibold text-text-primary">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close" className="shrink-0 text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
