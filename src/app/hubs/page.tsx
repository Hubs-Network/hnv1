import type { Metadata } from "next";
import { getAllHubs, extractCountries } from "@/lib/data/hubs";
import { HubDirectoryClient } from "./hub-directory-client";

export const metadata: Metadata = {
  title: "Browse Hubs",
  description:
    "Explore registered hubs in the Hubs Network. Filter by vocation, country, accommodation and more.",
};

export const dynamic = "force-dynamic";

export default async function HubsDirectoryPage() {
  const hubs = await getAllHubs();
  const countries = extractCountries(hubs);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-foreground">Hub Directory</h1>
        <p className="mt-2 text-muted">
          Browse and filter registered hubs across the network. Find hubs by
          location, vocation, accommodation type and more.
        </p>
      </div>

      <HubDirectoryClient hubs={hubs} countries={countries} />
    </div>
  );
}
