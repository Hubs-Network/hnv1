import { cn } from "@/lib/utils";
import {
  RESIDENCY_UI_STATUS_LABELS,
  type ResidencyUiStatus,
} from "@/config/residencies";

const STYLES: Record<ResidencyUiStatus, string> = {
  open: "bg-green-100 text-green-700 border-green-200",
  applications_closed: "bg-amber-100 text-amber-700 border-amber-200",
  closed: "bg-stone-200 text-stone-700 border-stone-300",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  none: "bg-stone-100 text-stone-500 border-stone-200",
};

export function ResidencyStatusBadge({ status }: { status: ResidencyUiStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap",
        STYLES[status]
      )}
    >
      {RESIDENCY_UI_STATUS_LABELS[status]}
    </span>
  );
}
