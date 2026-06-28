"use client";

import { useCallback, useEffect, useState } from "react";
import { getSkillLabel } from "@/lib/pilgrim-skills";

export interface CatalogCategory {
  id: string;
  label: string;
  skills: { id: string; label: string; custom: boolean }[];
}

export interface CatalogSkill {
  id: string;
  label: string;
  hash: `0x${string}`;
  categoryId: string;
  custom: boolean;
}

interface UseSkillCatalog {
  categories: CatalogCategory[];
  skills: CatalogSkill[];
  loading: boolean;
  reload: () => Promise<void>;
  /** Label for any skill id (canonical or custom), with a sensible fallback. */
  labelOf: (id: string) => string;
}

/**
 * Fetch the merged skill catalog (static + custom) once. Shared by the claim
 * selector and the admin "Add New Skill" panel so custom skills render as text.
 */
export function useSkillCatalog(): UseSkillCatalog {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [skills, setSkills] = useState<CatalogSkill[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pilgrim-passport/skills");
      const data = await res.json();
      if (res.ok) {
        setCategories(data.categories ?? []);
        setSkills(data.skills ?? []);
      }
    } catch {
      // keep whatever we had
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const labelOf = useCallback(
    (id: string) => {
      const found = skills.find((s) => s.id === id);
      if (found) return found.label;
      return getSkillLabel(id);
    },
    [skills]
  );

  return { categories, skills, loading, reload, labelOf };
}
