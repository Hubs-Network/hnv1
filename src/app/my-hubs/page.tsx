import type { Metadata } from "next";
import { MyHubsClient } from "./my-hubs-client";

export const metadata: Metadata = {
  title: "My Hubs",
  description: "Manage hubs you own or administer.",
};

export default function MyHubsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-foreground">My Hubs</h1>
        <p className="mt-2 text-muted">
          Hubs where you are registered as creator or administrator.
        </p>
      </div>

      <MyHubsClient />
    </div>
  );
}
