"use client";

import type { StepProps } from "../types";
import type { HubAsset, AssetCategory, AssetFocusArea } from "@/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ASSET_CATEGORIES, ASSET_FOCUS_AREAS } from "@/config/vocabularies";
import { Plus, Trash2 } from "lucide-react";

const emptyAsset = {
  name: "",
  category: "hardware" as const,
  focus_areas: [] as AssetFocusArea[],
  notes: "",
};

export function AssetsStep({ data, updateData, errors }: StepProps) {
  const assets = data.assets;

  function addAsset() {
    updateData({ assets: [...assets, { ...emptyAsset }] });
  }

  function removeAsset(index: number) {
    updateData({ assets: assets.filter((_, i) => i !== index) });
  }

  function updateAsset(index: number, patch: Partial<HubAsset>) {
    const updated = assets.map((a, i) =>
      i === index ? { ...a, ...patch } : a
    );
    updateData({ assets: updated });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        List notable tools, technologies and infrastructure available at your
        hub. This is optional but helps match pilgrims to your resources.
      </p>

      {assets.map((asset, i) => (
        <Card key={i} padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">
              Asset {i + 1}
            </h4>
            <button
              type="button"
              onClick={() => removeAsset(i)}
              className="text-muted-light hover:text-danger transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <Input
            label="Name"
            name={`asset-${i}-name`}
            placeholder="e.g. 3D Printer"
            value={asset.name}
            onChange={(e) => updateAsset(i, { name: e.target.value })}
            error={errors[`assets.${i}.name`]}
          />

          <Select
            label="Category"
            options={[...ASSET_CATEGORIES]}
            value={asset.category}
            onChange={(e) =>
              updateAsset(i, { category: e.target.value as AssetCategory })
            }
            error={errors[`assets.${i}.category`]}
          />

          <MultiSelect
            label="Focus Areas"
            options={ASSET_FOCUS_AREAS}
            value={asset.focus_areas}
            onChange={(val) =>
              updateAsset(i, { focus_areas: val as AssetFocusArea[] })
            }
            error={errors[`assets.${i}.focus_areas`]}
          />

          <Textarea
            label="Notes"
            name={`asset-${i}-notes`}
            placeholder="Optional details"
            value={asset.notes || ""}
            onChange={(e) => updateAsset(i, { notes: e.target.value })}
            rows={2}
          />
        </Card>
      ))}

      <Button type="button" variant="secondary" onClick={addAsset} className="w-full">
        <Plus className="w-4 h-4" />
        Add Asset
      </Button>
    </div>
  );
}
