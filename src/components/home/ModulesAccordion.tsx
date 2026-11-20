"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { ModuleCard } from "./ModuleCard";
import { ScrollReveal } from "./ScrollReveal";

type ModuleCardProps = Parameters<typeof ModuleCard>[0];

export function ModulesAccordion({ groups }: { groups: { label: string; modules: ModuleCardProps[] }[] }) {
  const [openState, setOpenState] = useState<boolean[]>(() => groups.map(() => true));

  function toggle(i: number) {
    setOpenState((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group, i) => {
        const isOpen = openState[i];
        return (
          <div key={group.label} className="border-b border-border-subtle pb-8 last:border-0 last:pb-0">
            <button
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-2 py-1 text-left"
            >
              <h3 className="font-mono text-[11px] tracking-wider text-text-muted uppercase">
                {group.label} <span className="text-text-muted/50">({group.modules.length})</span>
              </h3>
              <motion.span
                animate={{ rotate: isOpen ? 0 : -90 }}
                transition={{ duration: 0.2 }}
                className="text-text-muted"
              >
                <ChevronDown size={15} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 gap-4 pt-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.modules.map((m, idx) => (
                      <ScrollReveal key={m.id} delay={Math.min(idx, 6) * 0.04}>
                        <ModuleCard {...m} />
                      </ScrollReveal>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
