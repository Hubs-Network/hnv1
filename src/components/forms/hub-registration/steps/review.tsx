"use client";

import type { StepProps } from "../types";
import { Badge } from "@/components/ui/badge";
import { formatLabel } from "@/lib/utils";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border-light pb-5 last:border-0 last:pb-0">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value || (typeof value === "string" && !value.trim())) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-1">
      <span className="text-xs text-muted w-36 shrink-0">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

export function ReviewStep({ data }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-primary-bg border border-primary/20">
        <p className="text-sm text-primary">
          Review your hub profile below. If everything looks good, click
          &quot;Submit&quot; to register your hub.
        </p>
      </div>

      <Section title="Basic Info">
        <Field label="Name" value={data.name} />
        <Field label="Tagline" value={data.tagline} />
        <Field label="Description" value={data.description} />
        <Field label="Website" value={data.website} />
      </Section>

      <Section title="Contact & Location">
        <Field label="Contact" value={data.contact.contact_name} />
        <Field label="Email" value={data.contact.email} />
        <Field label="Telegram" value={data.contact.telegram} />
        <Field
          label="Preferred"
          value={data.contact.preferred_contact
            .map(formatLabel)
            .join(", ")}
        />
        <Field
          label="Location"
          value={`${data.location.city}, ${data.location.country}`}
        />
        <Field label="Region" value={data.location.region} />
        <Field label="Timezone" value={data.location.timezone} />
        <Field
          label="Languages"
          value={
            <div className="flex flex-wrap gap-1">
              {data.languages.map((l) => (
                <Badge key={l} label={l} size="sm" />
              ))}
            </div>
          }
        />
      </Section>

      <Section title="Identity">
        <Field
          label="Vocation"
          value={
            <div className="flex flex-wrap gap-1">
              {data.identity.vocation_tags.map((t) => (
                <Badge key={t} label={t} variant="primary" size="sm" />
              ))}
            </div>
          }
        />
        <Field
          label="Mission"
          value={data.identity.mission_keywords.join(", ")}
        />
        <Field
          label="Org Type"
          value={formatLabel(data.identity.organizational_type)}
        />
        <Field label="Stage" value={formatLabel(data.identity.stage)} />
        <Field
          label="Revenue"
          value={
            <div className="flex flex-wrap gap-1">
              {data.identity.revenue_models.map((r) => (
                <Badge key={r} label={r} size="sm" />
              ))}
            </div>
          }
        />
      </Section>

      <Section title={`Spaces (${data.spaces.length})`}>
        {data.spaces.map((s, i) => (
          <div key={i} className="py-2">
            <p className="text-sm font-medium text-foreground">{s.name}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {s.space_types.map((t) => (
                <Badge key={t} label={t} size="sm" variant="outline" />
              ))}
            </div>
            {s.host_capacity_day && (
              <p className="text-xs text-muted mt-1">
                Capacity: {s.host_capacity_day}/day
              </p>
            )}
          </div>
        ))}
      </Section>

      <Section title="Accommodation">
        <Field
          label="Type"
          value={formatLabel(data.accommodation.type)}
        />
        {data.accommodation.formats && data.accommodation.formats.length > 0 && (
          <Field
            label="Formats"
            value={data.accommodation.formats.map(formatLabel).join(", ")}
          />
        )}
        <Field label="Notes" value={data.accommodation.notes} />
      </Section>

      {data.assets.length > 0 && (
        <Section title={`Assets (${data.assets.length})`}>
          {data.assets.map((a, i) => (
            <div key={i} className="py-2">
              <p className="text-sm font-medium text-foreground">
                {a.name}{" "}
                <Badge label={a.category} size="sm" variant="outline" />
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {a.focus_areas.map((f) => (
                  <Badge key={f} label={f} size="sm" />
                ))}
              </div>
            </div>
          ))}
        </Section>
      )}

      {data.network.length > 0 && (
        <Section title={`Network (${data.network.length})`}>
          {data.network.map((n, i) => (
            <div key={i} className="py-2">
              <p className="text-sm font-medium text-foreground">
                {n.name}{" "}
                <Badge label={n.scale} size="sm" variant="accent" />
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {n.scope.map((s) => (
                  <Badge key={s} label={s} size="sm" />
                ))}
              </div>
            </div>
          ))}
        </Section>
      )}

      {data.challenges.length > 0 && (
        <Section title={`Challenges (${data.challenges.length})`}>
          {data.challenges.map((c, i) => (
            <div key={i} className="py-2">
              <p className="text-sm font-medium text-foreground">{c.title}</p>
              <p className="text-xs text-muted mt-1">
                Urgency: {c.urgency}/5 · Difficulty: {c.difficulty}/5
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {c.area.map((a) => (
                  <Badge key={a} label={a} size="sm" variant="accent" />
                ))}
              </div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
