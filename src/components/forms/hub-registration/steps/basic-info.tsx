"use client";

import type { StepProps } from "../types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function MinCharsHint({ value, min }: { value: string; min: number }) {
  const current = value.trim().length;
  const met = current >= min;
  return (
    <p
      className={`text-xs mt-1 transition-colors ${
        met ? "text-green-600" : "text-red-500"
      }`}
    >
      {met
        ? `Minimum reached (${current}/${min} characters)`
        : `Minimum ${min} characters (${current}/${min})`}
    </p>
  );
}

export function BasicInfoStep({ data, updateData, errors }: StepProps) {
  return (
    <div className="space-y-5">
      <div>
        <Input
          label="Hub Name"
          name="name"
          placeholder="e.g. Akasha Hub"
          value={data.name}
          onChange={(e) => updateData({ name: e.target.value })}
          error={errors.name}
        />
        <MinCharsHint value={data.name} min={2} />
      </div>

      <div>
        <Input
          label="Tagline"
          name="tagline"
          placeholder="A short sentence describing your hub's essence"
          value={data.tagline}
          onChange={(e) => updateData({ tagline: e.target.value })}
          error={errors.tagline}
        />
        <MinCharsHint value={data.tagline} min={5} />
      </div>

      <div>
        <Textarea
          label="Description"
          name="description"
          placeholder="A paragraph about what your hub does, its mission, and its community"
          value={data.description}
          onChange={(e) => updateData({ description: e.target.value })}
          error={errors.description}
          rows={4}
        />
        <MinCharsHint value={data.description} min={20} />
      </div>

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
