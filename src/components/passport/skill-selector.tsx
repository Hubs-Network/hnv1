"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { PILGRIM_SKILL_CATEGORIES } from "@/config/pilgrim-skill-categories";
import { getSkillLabel } from "@/lib/pilgrim-skills";

interface SkillSelectorProps {
  selected: string[];
  onChange: (next: string[]) => void;
  max?: number;
  /** Restrict selectable skills (e.g. to a claim's proposed skills). */
  availableSkillIds?: string[];
  disabled?: boolean;
}

/**
 * Grouped, multi-select skill picker (1..max). Skills are canonical IDs.
 */
export function SkillSelector({
  selected,
  onChange,
  max = 3,
  availableSkillIds,
  disabled = false,
}: SkillSelectorProps) {
  const allowed = useMemo(
    () => (availableSkillIds ? new Set(availableSkillIds) : null),
    [availableSkillIds]
  );

  const categories = useMemo(() => {
    return PILGRIM_SKILL_CATEGORIES.map((cat) => ({
      ...cat,
      skills: cat.skills.filter((s) => !allowed || allowed.has(s)),
    })).filter((cat) => cat.skills.length > 0);
  }, [allowed]);

  function toggle(skillId: string) {
    if (disabled) return;
    if (selected.includes(skillId)) {
      onChange(selected.filter((s) => s !== skillId));
    } else if (selected.length < max) {
      onChange([...selected, skillId]);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Select up to {max} skill{max > 1 ? "s" : ""} ({selected.length}/{max}).
      </p>
      {categories.map((cat) => (
        <div key={cat.id}>
          <h4 className="text-xs text-muted uppercase tracking-wider mb-1.5">
            {cat.label}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {cat.skills.map((skillId) => {
              const isSelected = selected.includes(skillId);
              const atLimit = !isSelected && selected.length >= max;
              return (
                <button
                  key={skillId}
                  type="button"
                  onClick={() => toggle(skillId)}
                  disabled={disabled || atLimit}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                    isSelected
                      ? "bg-primary text-white border-primary"
                      : "bg-surface text-foreground border-border hover:bg-stone-50",
                    (disabled || atLimit) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {getSkillLabel(skillId)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
