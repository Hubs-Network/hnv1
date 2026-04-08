import Link from "next/link";
import { getAllHubs } from "@/lib/data/hubs";
import { HubCard } from "@/components/hubs/hub-card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe, Database, Users, Layers } from "lucide-react";

export default async function HomePage() {
  const hubs = await getAllHubs();
  const featured = hubs.slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-bg text-primary text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Phase 1 — Hub Registry
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight leading-[1.1]">
              Residencies by{" "}
              <span className="text-primary">Hubs Network</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-muted leading-relaxed max-w-2xl">
              An open registry of hubs, their capabilities, spaces, networks and
              challenges — the first layer of a platform connecting hubs with
              pilgrims and patrons for regenerative residencies.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register/hub">
                <Button size="lg">
                  Register your Hub
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/hubs">
                <Button variant="secondary" size="lg">
                  Browse Hubs
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Building the residencies layer
            </h2>
            <p className="mt-3 text-muted max-w-2xl mx-auto">
              This platform maps hub assets, needs and networks to enable
              meaningful matches between hubs, visiting pilgrims and supporting
              patrons.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Globe,
                title: "Hubs",
                desc: "Physical spaces with unique vocations, assets and communities. Register and share your profile.",
                active: true,
              },
              {
                icon: Users,
                title: "Pilgrims",
                desc: "Skilled contributors who travel to hubs, bringing expertise matched to real needs.",
                active: false,
              },
              {
                icon: Layers,
                title: "Patrons",
                desc: "Supporters and funders who enable residencies and resource flows.",
                active: false,
              },
              {
                icon: Database,
                title: "Residencies",
                desc: "Structured programs matching pilgrims to hubs, tracked and evaluated openly.",
                active: false,
              },
            ].map((item) => (
              <div
                key={item.title}
                className={`rounded-xl border p-6 ${
                  item.active
                    ? "border-primary/30 bg-primary-bg"
                    : "border-border bg-surface opacity-60"
                }`}
              >
                <item.icon
                  className={`w-8 h-8 mb-4 ${
                    item.active ? "text-primary" : "text-muted-light"
                  }`}
                />
                <h3 className="font-semibold text-foreground mb-2">
                  {item.title}
                  {!item.active && (
                    <span className="ml-2 text-xs font-normal text-muted-light">
                      soon
                    </span>
                  )}
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Hubs */}
      {featured.length > 0 && (
        <section className="border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                  Registered Hubs
                </h2>
                <p className="mt-2 text-muted">
                  {hubs.length} {hubs.length === 1 ? "hub" : "hubs"} in the
                  network
                </p>
              </div>
              <Link href="/hubs">
                <Button variant="secondary" size="sm">
                  View all
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.map((hub) => (
                <HubCard key={hub.hub_id} hub={hub} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Data philosophy */}
      <section className="border-t border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              Transparent by design
            </h2>
            <p className="text-muted leading-relaxed">
              All hub data is stored as structured JSON in an open repository.
              No proprietary databases, no black boxes. Every profile can be
              read, compared and analyzed — vertically per hub, or horizontally
              across the network by any metric or category.
            </p>
            <div className="mt-8 flex justify-center">
              <Link href="/register/hub">
                <Button>
                  Add your hub to the network
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
