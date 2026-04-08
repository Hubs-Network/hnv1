"use client";

import type { StepProps } from "../types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function BasicInfoStep({ data, updateData, errors }: StepProps) {
  return (
    <div className="space-y-5">
      <Input
        label="Hub Name"
        name="name"
        placeholder="e.g. Akasha Hub"
        value={data.name}
        onChange={(e) => updateData({ name: e.target.value })}
        error={errors.name}
      />

      <Input
        label="Tagline"
        name="tagline"
        placeholder="A short sentence describing your hub's essence"
        value={data.tagline}
        onChange={(e) => updateData({ tagline: e.target.value })}
        error={errors.tagline}
      />

      <Textarea
        label="Description"
        name="description"
        placeholder="A paragraph about what your hub does, its mission, and its community"
        value={data.description}
        onChange={(e) => updateData({ description: e.target.value })}
        error={errors.description}
        rows={4}
      />

      <Input
        label="Website"
        name="website"
        type="url"
        placeholder="https://yourhub.org"
        value={data.website || ""}
        onChange={(e) => updateData({ website: e.target.value })}
        error={errors.website}
        hint="Optional"
      />
    </div>
  );
}
