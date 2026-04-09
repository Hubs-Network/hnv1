import type { Metadata } from "next";
import { EditHubClient } from "./edit-hub-client";

export const metadata: Metadata = {
  title: "Edit Hub",
  description: "Edit your hub profile.",
};

export default function EditHubPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <EditHubClient />
    </div>
  );
}
