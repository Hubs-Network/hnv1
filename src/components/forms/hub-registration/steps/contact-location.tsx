"use client";

import type { StepProps } from "../types";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { LANGUAGES } from "@/config/vocabularies";
import type { Language } from "@/types";

export function ContactLocationStep({ data, updateData, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Contact</h3>
        <div className="space-y-4">
          <Input
            label="Contact Name"
            name="contact_name"
            placeholder="Full name of the primary contact"
            value={data.contact.contact_name}
            onChange={(e) =>
              updateData({
                contact: { ...data.contact, contact_name: e.target.value },
              })
            }
            error={errors["contact.contact_name"]}
          />
        </div>
      </div>

      <div className="border-t border-border-light pt-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Location</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="City"
              name="city"
              placeholder="e.g. Barcelona"
              value={data.location.city}
              onChange={(e) =>
                updateData({
                  location: { ...data.location, city: e.target.value },
                })
              }
              error={errors["location.city"]}
            />

            <Input
              label="Country"
              name="country"
              placeholder="e.g. Spain"
              value={data.location.country}
              onChange={(e) =>
                updateData({
                  location: { ...data.location, country: e.target.value },
                })
              }
              error={errors["location.country"]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Region"
              name="region"
              placeholder="e.g. Catalonia"
              value={data.location.region || ""}
              onChange={(e) =>
                updateData({
                  location: { ...data.location, region: e.target.value },
                })
              }
              hint="Optional"
            />

            <Input
              label="Timezone"
              name="timezone"
              placeholder="e.g. Europe/Madrid"
              value={data.location.timezone || ""}
              onChange={(e) =>
                updateData({
                  location: { ...data.location, timezone: e.target.value },
                })
              }
              hint="Optional"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border-light pt-6">
        <MultiSelect
          label="Languages spoken at the hub"
          options={LANGUAGES}
          value={data.languages}
          onChange={(val) => updateData({ languages: val as Language[] })}
          error={errors.languages}
        />
      </div>
    </div>
  );
}
