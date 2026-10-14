"use client";

import { useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_MILESTONES,
  MILESTONE_TITLE_MAX,
  MILESTONE_DESC_MAX,
} from "@/lib/schemas/residency-milestones";

export interface EditableMilestone {
  id: string;
  title: string;
  description: string;
}

/** Generate a client-side id for a new row (server keeps provided ids). */
function newMilestoneId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Create a client-side id for a new row (server keeps provided ids). */
export function newMilestone(): EditableMilestone {
  return { id: newMilestoneId(), title: "", description: "" };
}

/** Create an editable row seeded from a predefined milestone title. */
export function milestoneFromTitle(title: string): EditableMilestone {
  return { id: newMilestoneId(), title, description: "" };
}

/**
 * Draft/submitted milestone editor with add / edit / delete / drag-reorder.
 * Uses native HTML5 drag and drop (no extra dependency).
 */
export function MilestoneListEditor({
  items,
  onChange,
  disabled,
}: {
  items: EditableMilestone[];
  onChange: (items: EditableMilestone[]) => void;
  disabled?: boolean;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function update(id: string, patch: Partial<EditableMilestone>) {
    onChange(items.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }
  function remove(id: string) {
    onChange(items.filter((m) => m.id !== id));
  }
  function add() {
    if (items.length >= MAX_MILESTONES) return;
    onChange([...items, newMilestone()]);
  }

  function handleDrop(target: number) {
    if (dragIndex === null || dragIndex === target) {
      setDragIndex(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(target, 0, moved);
    onChange(next);
    setDragIndex(null);
  }

  return (
    <div className="space-y-3">
      {items.map((m, i) => (
        <div
          key={m.id}
          draggable={!disabled}
          onDragStart={() => setDragIndex(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(i)}
          className={
            "rounded-lg border border-border bg-surface p-3 " +
            (dragIndex === i ? "opacity-60" : "")
          }
        >
          <div className="flex items-start gap-2">
            <button
              type="button"
              className="mt-2 cursor-grab text-muted-light hover:text-muted active:cursor-grabbing"
              aria-label="Drag to reorder"
              disabled={disabled}
            >
              <GripVertical className="w-4 h-4" />
            </button>
            <div className="flex-1 space-y-2">
              <Input
                value={m.title}
                maxLength={MILESTONE_TITLE_MAX}
                placeholder={`Milestone ${i + 1} title`}
                onChange={(e) => update(m.id, { title: e.target.value })}
                disabled={disabled}
              />
              <Textarea
                value={m.description}
                maxLength={MILESTONE_DESC_MAX}
                rows={2}
                placeholder="Optional detail (what 'done' means, deliverables…)"
                onChange={(e) => update(m.id, { description: e.target.value })}
                disabled={disabled}
              />
            </div>
            <button
              type="button"
              onClick={() => remove(m.id)}
              className="mt-2 p-1 text-muted hover:text-red-600"
              aria-label="Remove milestone"
              disabled={disabled}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        disabled={disabled || items.length >= MAX_MILESTONES}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline disabled:opacity-50 disabled:no-underline"
      >
        <Plus className="w-4 h-4" />
        Add milestone ({items.length}/{MAX_MILESTONES})
      </button>
    </div>
  );
}
