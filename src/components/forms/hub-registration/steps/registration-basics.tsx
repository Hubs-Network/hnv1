"use client";

import type { StepProps } from "../types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MinCharsHint } from "../min-chars-hint";

/**
 * Simplified single-step Basic Info used for the streamlined hub registration.
 *
 * Collects only the essentials needed to spin up a hub: name, tagline,
 * description, website, location (city + country) and a contact name. All the
 * remaining profile fields are filled later from the hub dashboard
 * ("Edit Hub Profile"). This step intentionally does NOT change the underlying
 * registration stack (schema / API / Safe deploy) — it only reduces the UI.
 */
export function RegistrationBasicsStep({ data, updateData, errors }: StepProps) {
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
  );
}
