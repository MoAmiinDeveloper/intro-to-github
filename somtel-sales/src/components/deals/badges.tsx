import { AlarmClock, Hourglass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FollowUpBucket } from "@/lib/pipeline";

export function StaleBadge({ days }: { days: number }) {
  return (
    <Badge tone="amber" title={`No activity for ${days} days`}>
      <Hourglass className="mr-1 h-3 w-3" /> Stale {days}d
    </Badge>
  );
}

export function FollowUpBadge({ bucket }: { bucket: FollowUpBucket }) {
  if (bucket === "overdue")
    return (
      <Badge tone="red">
        <AlarmClock className="mr-1 h-3 w-3" /> Follow-up overdue
      </Badge>
    );
  if (bucket === "today")
    return (
      <Badge tone="gold">
        <AlarmClock className="mr-1 h-3 w-3" /> Follow-up today
      </Badge>
    );
  return null;
}

export const PRODUCT_TYPE_SHORT = { IT: "IT", NON_IT: "Non-IT", TRACKING: "Tracking" } as const;
export const PRODUCT_TYPE_TONE = { IT: "blue", NON_IT: "navy", TRACKING: "amber" } as const;
