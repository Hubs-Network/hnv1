"use client";

import { useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PILGRIM_SKILL_CATEGORIES } from "@/config/pilgrim-skill-categories";
import { getSkillLabel } from "@/lib/pilgrim-skills";
import { useSkillCatalog } from "@/lib/use-skill-catalog";

interface SkillSelectorProps {
  selected: string[];
  onChange: (next: string[]) => void;
  max?: number;
  /** Restrict selectable skills (e.g. to a claim's proposed skills). */
  availableSkillIds?: string[];
  disabled?: boolean;
  /** When true, the helper text asks for EXACTLY `max` skills (Patron flow). */
  exact?: boolean;
  /**
   * When true, offer ONLY the canonical skills hardcoded at deploy time
   * (static taxonomy), ignoring HN-admin custom skills from the runtime catalog.
   * Used by the Patron flow: HubsNetworkPatronSBT only knows its deploy-time
   * skills, so custom Passport skills would fail its on-chain `validSkill` check.
   */
  canonicalOnly?: boolean;
  /**
   * Progressive-disclosure mode: categories are collapsible (collapsed by
   * default) and a removable summary of the selected skills is shown at the
   * bottom for a final check. Opt-in so existing flows keep the flat layout.
   */
  collapsible?: boolean;
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
  exact = false,
  canonicalOnly = false,
  collapsible = false,
}: SkillSelectorProps) {
  const { categories: catalogCategories, labelOf } = useSkillCatalog();
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());

  // Canonical-only ignores the runtime catalog (no custom skills) and resolves
  // labels from the static taxonomy.
  const resolveLabel = canonicalOnly ? getSkillLabel : labelOf;

  const allowed = useMemo(
    () => (availableSkillIds ? new Set(availableSkillIds) : null),
    [availableSkillIds]
  );

  // Use the live catalog (static + custom skills) once loaded; fall back to the
  // static taxonomy while it's loading so the picker is never empty.
  const baseCategories = useMemo(() => {
    // Patron flow: always use the static, deploy-time canonical taxonomy.
    if (canonicalOnly) {
      return PILGRIM_SKILL_CATEGORIES.map((cat) => ({
        id: cat.id,
        label: cat.label,
        skills: [...cat.skills] as string[],
      }));
    }
    if (catalogCategories.length > 0) {
      return catalogCategories.map((cat) => ({
        id: cat.id,
        label: cat.label,
        skills: cat.skills.map((s) => s.id),
      }));
    }
    return PILGRIM_SKILL_CATEGORIES.map((cat) => ({
      id: cat.id,
      label: cat.label,
      skills: [...cat.skills] as string[],
    }));
  }, [catalogCategories, canonicalOnly]);

  const categories = useMemo(() => {
    return baseCategories
      .map((cat) => ({
        ...cat,
        skills: cat.skills.filter((s) => !allowed || allowed.has(s)),
      }))
      .filter((cat) => cat.skills.length > 0);
  }, [baseCategories, allowed]);

  function toggle(skillId: string) {
    if (disabled) return;
    if (selected.includes(skillId)) {
      onChange(selected.filter((s) => s !== skillId));
    } else if (selected.length < max) {
      onChange([...selected, skillId]);
    }
  }

  function toggleCat(id: string) {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** A single selectable skill chip (shared by both layouts). */
  function SkillChip({ skillId }: { skillId: string }) {
    const isSelected = selected.includes(skillId);
    const atLimit = !isSelected && selected.length >= max;
    return (
      <button
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
        {resolveLabel(skillId)}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        {exact ? "Select exactly" : "Select up to"} {max} skill
        {max > 1 ? "s" : ""} ({selected.length}/{max}).
      </p>

      {collapsible ? (
        <div className="space-y-2">
          {categories.map((cat) => {
            const open = openCats.has(cat.id);
            const selectedInCat = cat.skills.filter((s) =>
              selected.includes(s)
            ).length;
            return (
              <div
                key={cat.id}
                className="rounded-lg border border-border overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleCat(cat.id)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-stone-50 transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {cat.label}
                    {selectedInCat > 0 && (
                      <span className="inline-flex items-center rounded-full bg-primary-bg text-primary px-2 py-0.5 text-xs font-semibold">
                        {selectedInCat}
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-muted shrink-0 transition-transform",
                      open && "rotate-180"
                    )}
                  />
                </button>
                {open && (
                  <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5">
                    {cat.skills.map((skillId) => (
                      <SkillChip key={skillId} skillId={skillId} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        categories.map((cat) => (
          <div key={cat.id}>
            <h4 className="text-xs text-muted uppercase tracking-wider mb-1.5">
              {cat.label}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {cat.skills.map((skillId) => (
                <SkillChip key={skillId} skillId={skillId} />
              ))}
            </div>
          </div>
        ))
      )}

      {collapsible && (
        <div className="rounded-lg border border-dashed border-border bg-stone-50/60 p-3">
          <p className="text-xs font-medium text-foreground mb-2">
            Selected skills ({selected.length}/{max})
          </p>
          {selected.length === 0 ? (
            <p className="text-xs text-muted">
              No skills selected yet. Open a category above to choose.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((skillId) => (
                <span
                  key={skillId}
                  className="inline-flex items-center gap-1 rounded-full bg-primary text-white pl-2.5 pr-1 py-1 text-xs font-medium"
                >
                  {resolveLabel(skillId)}
                  <button
                    type="button"
                    onClick={() => toggle(skillId)}
                    disabled={disabled}
                    aria-label={`Remove ${resolveLabel(skillId)}`}
                    className="rounded-full p-0.5 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
