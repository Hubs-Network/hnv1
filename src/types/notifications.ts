/**
 * Shared notification shapes used by the user-menu dropdown and the passport
 * section. Pure types only (no runtime imports) so both client and server
 * modules can depend on this file safely.
 */

export type NotificationType =
  | "hub_sbt_minted"
  | "passport_minted"
  | "admin_hub_claim"
  | "residency_selected";

/**
 * Where a notification is surfaced:
 * - "menu": the top-right user dropdown.
 * - "passport": the pilgrim's passport section.
 */
export type NotificationChannel = "menu" | "passport";

export interface AppNotification {
  /** Stable, content-derived id used for client-side "seen once" dismissal. */
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  href?: string;
  /**
   * When true the notification should disappear after the user has seen it once
   * (tracked client-side). When false it is state-driven and vanishes on its own
   * once the underlying condition clears (e.g. an admin claim gets minted).
   */
  dismissible: boolean;
}
