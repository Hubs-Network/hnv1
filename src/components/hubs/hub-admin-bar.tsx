"use client";

import { useUP } from "@/context/up-context";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

interface HubAdminBarProps {
  hubId: string;
  admins: string[];
}

export function HubAdminBar({ hubId, admins }: HubAdminBarProps) {
  const { address, isConnected } = useUP();

  if (!isConnected || !address) return null;

  const isAdmin = admins
    .map((a) => a.toLowerCase())
    .includes(address.toLowerCase());

  if (!isAdmin) return null;

  return (
    <div className="mb-6 p-3 rounded-lg bg-primary-bg border border-primary/20 flex items-center justify-between">
      <p className="text-sm text-primary font-medium">
        You are an admin of this hub
      </p>
      <Link href={`/hubs/${hubId}/edit`}>
        <Button variant="primary" size="sm">
          <Settings className="w-3.5 h-3.5" />
          Edit
        </Button>
      </Link>
    </div>
  );
}
