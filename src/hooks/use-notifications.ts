"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppNotification } from "@/types/notifications";

const SEEN_KEY = "hn:notif:seen";

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function persistSeen(seen: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

interface UseNotificationsResult {
  /** All notifications returned by the server (unfiltered). */
  all: AppNotification[];
  /** Notifications still worth showing (dismissible ones not yet seen). */
  visible: AppNotification[];
  /** Mark every currently-visible dismissible notification as seen. */
  markVisibleSeen: () => void;
  refresh: () => void;
}

/**
 * Fetches a wallet's notifications and applies client-side "seen once"
 * dismissal (persisted in localStorage) for the dismissible ones.
 */
export function useNotifications(
  owner: string | null | undefined
): UseNotificationsResult {
  const [all, setAll] = useState<AppNotification[]>([]);
  const [seen, setSeen] = useState<Set<string>>(() => loadSeen());

  const refresh = useCallback(() => {
    if (!owner) {
      setAll([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/notifications?owner=${encodeURIComponent(owner)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.notifications)) {
          setAll(data.notifications as AppNotification[]);
        }
      } catch {
        // keep previous state on transient errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [owner]);

  useEffect(() => {
    if (!owner) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAll([]);
      return;
    }
    const cleanup = refresh();
    return cleanup;
  }, [owner, refresh]);

  const visible = all.filter((n) => !(n.dismissible && seen.has(n.id)));

  // Marking "seen" simply records every dismissible notification currently
  // known; visible-dismissible is exactly "dismissible minus already-seen", so
  // adding them all is equivalent and avoids reading derived values in render.
  const markVisibleSeen = useCallback(() => {
    setSeen((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const n of all) {
        if (n.dismissible && !next.has(n.id)) {
          next.add(n.id);
          changed = true;
        }
      }
      if (!changed) return prev;
      persistSeen(next);
      return next;
    });
  }, [all]);

  return { all, visible, markVisibleSeen, refresh };
}
