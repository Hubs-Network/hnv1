import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAllHubs, getHubById } from "@/lib/data/hubs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScoreBar } from "@/components/ui/score-bar";
import { Button } from "@/components/ui/button";
import { formatLabel, formatDate } from "@/lib/utils";
import { HubAdminBar } from "@/components/hubs/hub-admin-bar";
import {
  MapPin,
  Globe,
  Mail,
  Building2,
  Bed,
  Wrench,
  Users,
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Clock,
} from "lucide-react";

interface PageProps {
  params: Promise<{ hubId: string }>;
}

export async function generateStaticParams() {
  const hubs = await getAllHubs();
  return hubs.map((hub) => ({ hubId: hub.hub_id }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { hubId } = await params;
  const hub = await getHubById(hubId);
  if (!hub) return { title: "Hub not found" };

  return {
    title: hub.name,
    description: hub.tagline,
  };
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2.5 mb-4">
        <Icon className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default async function HubDetailPage({ params }: PageProps) {
  const { hubId } = await params;
  const hub = await getHubById(hubId);

  if (!hub) notFound();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Back link */}
      <Link
        href="/hubs"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to directory
      </Link>

      <HubAdminBar hubId={hub.hub_id} admins={hub.admins || []} />

      {/* Header */}
      <div className="mb-10">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
            {hub.name}
          </h1>
          <Badge
            label={hub.identity.organizational_type}
            variant="outline"
            size="md"
          />
          <Badge label={hub.identity.stage} variant="primary" size="md" />
        </div>

        <p className="text-lg text-muted leading-relaxed max-w-3xl">
          {hub.tagline}
        </p>

        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4" />
            {hub.location.city}
            {hub.location.region && `, ${hub.location.region}`},{" "}
            {hub.location.country}
          </span>
          {hub.location.timezone && (
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {hub.location.timezone}
            </span>
          )}
          {hub.website && (
            <a
              href={hub.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-primary hover:underline"
            >
              <Globe className="w-4 h-4" />
              Website
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-10">
          {/* Description */}
          <section>
            <p className="text-base text-foreground leading-relaxed">
              {hub.description}
            </p>
          </section>

          {/* Vocation & Identity */}
          <Section icon={Building2} title="Identity">
            <div className="space-y-4">
              <div>
                <h3 className="text-xs text-muted uppercase tracking-wider mb-2">
                  Vocation
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {hub.identity.vocation_tags.map((tag) => (
                    <Badge
                      key={tag}
                      label={tag}
                      variant="primary"
                      size="md"
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs text-muted uppercase tracking-wider mb-2">
                  Mission Keywords
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {hub.identity.mission_keywords.map((kw) => (
                    <Badge key={kw} label={kw} raw size="sm" />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs text-muted uppercase tracking-wider mb-2">
                  Revenue Models
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {hub.identity.revenue_models.map((r) => (
                    <Badge key={r} label={r} variant="accent" size="sm" />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Spaces */}
          <Section icon={Building2} title="Spaces">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {hub.spaces.map((space, i) => (
                <Card key={i} padding="sm">
                  <h3 className="font-medium text-foreground mb-2">
                    {space.name}
                  </h3>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {space.space_types.map((t) => (
                      <Badge
                        key={t}
                        label={t}
                        variant="outline"
                        size="sm"
                      />
                    ))}
                  </div>
                  {space.host_capacity_day && (
                    <p className="text-xs text-muted">
                      Capacity: {space.host_capacity_day} people/day
                    </p>
                  )}
                  {space.notes && (
                    <p className="text-xs text-muted mt-1">{space.notes}</p>
                  )}
                </Card>
              ))}
            </div>
          </Section>

          {/* Challenges */}
          {hub.challenges.length > 0 && (
            <Section icon={AlertTriangle} title="Challenges">
              <div className="space-y-4">
                {hub.challenges.map((challenge, i) => (
                  <Card key={i} padding="md">
                    <h3 className="font-semibold text-foreground mb-2">
                      {challenge.title}
                    </h3>
                    <p className="text-sm text-muted mb-3">
                      {challenge.problem_description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {challenge.area.map((a) => (
                        <Badge
                          key={a}
                          label={a}
                          variant="accent"
                          size="sm"
                        />
                      ))}
                    </div>

                    <div className="flex gap-4 text-xs text-muted mb-4">
                      <span>
                        Urgency:{" "}
                        <strong className="text-foreground">
                          {challenge.urgency}/5
                        </strong>
                      </span>
                      <span>
                        Difficulty:{" "}
                        <strong className="text-foreground">
                          {challenge.difficulty}/5
                        </strong>
                      </span>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs text-muted uppercase tracking-wider">
                        Impact Scores
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {(
                          Object.entries(challenge.impact_scores) as [
                            string,
                            number,
                          ][]
                        ).map(([key, val]) => (
                          <ScoreBar key={key} label={key} value={val} />
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border-light">
                      <h4 className="text-xs text-muted uppercase tracking-wider mb-1">
                        Expected Solution
                      </h4>
                      <p className="text-sm text-foreground">
                        {challenge.expected_solution}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact */}
          <Card padding="md">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              Contact
            </h3>
            <div className="space-y-2 text-sm">
              <p className="text-foreground">{hub.contact.contact_name}</p>
              <a
                href={`mailto:${hub.contact.email}`}
                className="text-primary hover:underline block"
              >
                {hub.contact.email}
              </a>
              {hub.contact.telegram && (
                <p className="text-muted">Telegram: {hub.contact.telegram}</p>
              )}
              <div className="flex flex-wrap gap-1 pt-1">
                {hub.contact.preferred_contact.map((m) => (
                  <Badge key={m} label={m} size="sm" variant="outline" />
                ))}
              </div>
            </div>
          </Card>

          {/* Languages */}
          <Card padding="md">
            <h3 className="font-semibold text-foreground mb-3">Languages</h3>
            <div className="flex flex-wrap gap-1.5">
              {hub.languages.map((l) => (
                <Badge key={l} label={l} size="sm" />
              ))}
            </div>
          </Card>

          {/* Accommodation */}
          <Card padding="md">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Bed className="w-4 h-4 text-primary" />
              Accommodation
            </h3>
            <Badge
              label={hub.accommodation.type}
              variant="primary"
              size="md"
            />
            {hub.accommodation.formats &&
              hub.accommodation.formats.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {hub.accommodation.formats.map((f) => (
                    <Badge key={f} label={f} size="sm" variant="outline" />
                  ))}
                </div>
              )}
            {hub.accommodation.notes && (
              <p className="text-xs text-muted mt-2">
                {hub.accommodation.notes}
              </p>
            )}
          </Card>

          {/* Assets */}
          {hub.assets.length > 0 && (
            <Card padding="md">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-primary" />
                Assets ({hub.assets.length})
              </h3>
              <div className="space-y-3">
                {hub.assets.map((asset, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {asset.name}
                      </span>
                      <Badge
                        label={asset.category}
                        size="sm"
                        variant="outline"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {asset.focus_areas.map((f) => (
                        <Badge key={f} label={f} size="sm" />
                      ))}
                    </div>
                    {asset.notes && (
                      <p className="text-xs text-muted mt-1">{asset.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Network */}
          {hub.network.length > 0 && (
            <Card padding="md">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Network ({hub.network.length})
              </h3>
              <div className="space-y-3">
                {hub.network.map((entry, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {entry.name}
                      </span>
                      <Badge
                        label={entry.scale}
                        size="sm"
                        variant="accent"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {entry.scope.map((s) => (
                        <Badge key={s} label={s} size="sm" />
                      ))}
                    </div>
                    {entry.url && (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
                      >
                        Visit <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Metadata */}
          <Card padding="sm" className="bg-stone-50">
            <div className="text-xs text-muted space-y-1">
              <p>
                Submitted: {formatDate(hub.metadata.submitted_at)} by{" "}
                {hub.metadata.submitted_by}
              </p>
              <p>Schema: v{hub.schema_version}</p>
              <p>ID: {hub.hub_id}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
