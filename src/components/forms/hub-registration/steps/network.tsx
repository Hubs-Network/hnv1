"use client";

import type { StepProps } from "../types";
import type { HubNetworkEntry, NetworkScale, NetworkScope } from "@/types";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NETWORK_SCALES, NETWORK_SCOPES } from "@/config/vocabularies";
import { Plus, Trash2 } from "lucide-react";

const emptyEntry = {
  name: "",
  scale: "local" as const,
  scope: [] as NetworkScope[],
  url: "",
};

export function NetworkStep({ data, updateData, errors }: StepProps) {
  const network = data.network;

  function addEntry() {
    updateData({ network: [...network, { ...emptyEntry }] });
  }

  function removeEntry(index: number) {
    updateData({ network: network.filter((_, i) => i !== index) });
  }

  function updateEntry(index: number, patch: Partial<HubNetworkEntry>) {
    const updated = network.map((n, i) =>
      i === index ? { ...n, ...patch } : n
    );
    updateData({ network: updated });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Add partner organizations, institutions and networks your hub is
        connected with. This is optional.
      </p>

      {network.map((entry, i) => (
        <Card key={i} padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">
              Partner {i + 1}
            </h4>
            <button
              type="button"
              onClick={() => removeEntry(i)}
              className="text-muted-light hover:text-danger transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <Input
            label="Organization Name"
            name={`network-${i}-name`}
            placeholder="e.g. Local University"
            value={entry.name}
            onChange={(e) => updateEntry(i, { name: e.target.value })}
            error={errors[`network.${i}.name`]}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Scale"
              options={[...NETWORK_SCALES]}
              value={entry.scale}
              onChange={(e) =>
                updateEntry(i, { scale: e.target.value as NetworkScale })
              }
              error={errors[`network.${i}.scale`]}
            />

            <Input
              label="Website"
              name={`network-${i}-url`}
              type="url"
              placeholder="https://example.org"
              value={entry.url || ""}
              onChange={(e) => updateEntry(i, { url: e.target.value })}
              hint="Optional"
            />
          </div>

          <MultiSelect
            label="Scope"
            options={NETWORK_SCOPES}
            value={entry.scope}
            onChange={(val) =>
              updateEntry(i, { scope: val as NetworkScope[] })
            }
            error={errors[`network.${i}.scope`]}
            placeholder="What does this partnership involve?"
          />
        </Card>
      ))}

      <Button type="button" variant="secondary" onClick={addEntry} className="w-full">
        <Plus className="w-4 h-4" />
        Add Network Partner
      </Button>
    </div>
  );
}
