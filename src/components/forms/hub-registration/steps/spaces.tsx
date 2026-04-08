"use client";

import type { StepProps } from "../types";
import type { HubSpace, SpaceType } from "@/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SPACE_TYPES } from "@/config/vocabularies";
import { Plus, Trash2 } from "lucide-react";

const emptySpace = {
  name: "",
  space_types: [] as SpaceType[],
  host_capacity_day: undefined as number | undefined,
  notes: "",
};

export function SpacesStep({ data, updateData, errors }: StepProps) {
  const spaces = data.spaces;

  function addSpace() {
    updateData({ spaces: [...spaces, { ...emptySpace }] });
  }

  function removeSpace(index: number) {
    updateData({ spaces: spaces.filter((_, i) => i !== index) });
  }

  function updateSpace(index: number, patch: Partial<HubSpace>) {
    const updated = spaces.map((s, i) =>
      i === index ? { ...s, ...patch } : s
    );
    updateData({ spaces: updated });
  }

  return (
    <div className="space-y-4">
      {spaces.length === 0 && (
        <p className="text-sm text-muted py-4 text-center">
          No spaces added yet. Add at least one space.
        </p>
      )}

      {spaces.map((space, i) => (
        <Card key={i} padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">
              Space {i + 1}
            </h4>
            {spaces.length > 1 && (
              <button
                type="button"
                onClick={() => removeSpace(i)}
                className="text-muted-light hover:text-danger transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <Input
            label="Space Name"
            name={`space-${i}-name`}
            placeholder="e.g. Main Hall"
            value={space.name}
            onChange={(e) => updateSpace(i, { name: e.target.value })}
            error={errors[`spaces.${i}.name`]}
          />

          <MultiSelect
            label="Space Types"
            options={SPACE_TYPES}
            value={space.space_types}
            onChange={(val) =>
              updateSpace(i, { space_types: val as SpaceType[] })
            }
            error={errors[`spaces.${i}.space_types`]}
          />

          <Input
            label="Day Capacity"
            name={`space-${i}-capacity`}
            type="number"
            min={0}
            placeholder="e.g. 40"
            value={space.host_capacity_day ?? ""}
            onChange={(e) =>
              updateSpace(i, {
                host_capacity_day: e.target.value
                  ? parseInt(e.target.value)
                  : undefined,
              })
            }
            hint="Optional — maximum people per day"
          />

          <Textarea
            label="Notes"
            name={`space-${i}-notes`}
            placeholder="Any additional details about this space"
            value={space.notes || ""}
            onChange={(e) => updateSpace(i, { notes: e.target.value })}
            rows={2}
          />
        </Card>
      ))}

      <Button type="button" variant="secondary" onClick={addSpace} className="w-full">
        <Plus className="w-4 h-4" />
        Add Space
      </Button>

      {errors.spaces && (
        <p className="text-xs text-danger">{errors.spaces}</p>
      )}
    </div>
  );
}
