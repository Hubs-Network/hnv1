"use client";

import type { StepProps } from "../types";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCOMMODATION_TYPES,
  ACCOMMODATION_FORMATS,
} from "@/config/vocabularies";
import type { AccommodationType, AccommodationFormat } from "@/types";

export function AccommodationStep({ data, updateData, errors }: StepProps) {
  return (
    <div className="space-y-5">
      <Select
        label="Accommodation Type"
        options={[...ACCOMMODATION_TYPES]}
        value={data.accommodation.type}
        onChange={(e) =>
          updateData({
            accommodation: {
              ...data.accommodation,
              type: e.target.value as AccommodationType,
            },
          })
        }
        error={errors["accommodation.type"]}
        placeholder="Select type"
      />

      {data.accommodation.type !== "none" && (
        <MultiSelect
          label="Formats Available"
          options={ACCOMMODATION_FORMATS}
          value={data.accommodation.formats || []}
          onChange={(val) =>
            updateData({
              accommodation: {
                ...data.accommodation,
                formats: val as AccommodationFormat[],
              },
            })
          }
          error={errors["accommodation.formats"]}
          placeholder="Select available formats"
        />
      )}

      <Textarea
        label="Notes"
        name="accommodation-notes"
        placeholder="Any details about accommodation — capacity, length of stay, special arrangements…"
        value={data.accommodation.notes || ""}
        onChange={(e) =>
          updateData({
            accommodation: { ...data.accommodation, notes: e.target.value },
          })
        }
        rows={3}
      />
    </div>
  );
}
