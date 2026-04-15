"use client";

import { useState } from "react";
import type { StepProps } from "../types";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  VOCATION_TAGS,
  ORGANIZATIONAL_TYPES,
  STAGES,
  REVENUE_MODELS,
} from "@/config/vocabularies";
import type { VocationTag, OrganizationalType, Stage, RevenueModel } from "@/types";
import { Plus, X } from "lucide-react";

export function IdentityStep({ data, updateData, errors }: StepProps) {
  const [newKeyword, setNewKeyword] = useState("");

  function addKeyword() {
    const kw = newKeyword.trim();
    if (!kw || data.identity.mission_keywords.includes(kw)) return;
    updateData({
      identity: {
        ...data.identity,
        mission_keywords: [...data.identity.mission_keywords, kw],
      },
    });
    setNewKeyword("");
  }

  function removeKeyword(kw: string) {
    updateData({
      identity: {
        ...data.identity,
        mission_keywords: data.identity.mission_keywords.filter(
          (k) => k !== kw
        ),
      },
    });
  }

  return (
    <div className="space-y-6">
      <MultiSelect
        label="Vocation Tags"
        options={VOCATION_TAGS}
        value={data.identity.vocation_tags}
        onChange={(val) =>
          updateData({
            identity: {
              ...data.identity,
              vocation_tags: val as VocationTag[],
            },
          })
        }
        error={errors["identity.vocation_tags"]}
        placeholder="What does your hub focus on?"
      />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Mission Keywords
        </label>
        <div className="flex gap-2">
          <Input
            name="keyword"
            placeholder="e.g. regenerative culture"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addKeyword();
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={addKeyword}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {data.identity.mission_keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {data.identity.mission_keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 text-xs"
              >
                {kw}
                <button
                  type="button"
                  onClick={() => removeKeyword(kw)}
                  className="hover:text-danger"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {errors["identity.mission_keywords"] && (
          <p className="text-xs text-danger">
            {errors["identity.mission_keywords"]}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Organization Type"
          options={[...ORGANIZATIONAL_TYPES]}
          value={data.identity.organizational_type}
          onChange={(e) =>
            updateData({
              identity: {
                ...data.identity,
                organizational_type: e.target.value as OrganizationalType,
              },
            })
          }
          error={errors["identity.organizational_type"]}
          placeholder="Select type"
        />

        <Select
          label="Stage"
          options={[...STAGES]}
          value={data.identity.stage}
          onChange={(e) =>
            updateData({
              identity: {
                ...data.identity,
                stage: e.target.value as Stage,
              },
            })
          }
          error={errors["identity.stage"]}
          placeholder="Select stage"
        />
      </div>

      <MultiSelect
        label="Revenue Models"
        options={REVENUE_MODELS}
        value={data.identity.revenue_models}
        onChange={(val) =>
          updateData({
            identity: {
              ...data.identity,
              revenue_models: val as RevenueModel[],
            },
          })
        }
        error={errors["identity.revenue_models"]}
        placeholder="How does your hub generate revenue?"
      />

      <Textarea
        label="Revenue Notes"
        name="revenue_notes"
        placeholder="Brief notes on your revenue model"
        value={data.identity.revenue_notes || ""}
        onChange={(e) =>
          updateData({
            identity: {
              ...data.identity,
              revenue_notes: e.target.value,
            },
          })
        }
        rows={2}
        hint="Optional"
      />
    </div>
  );
}
