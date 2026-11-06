import Link from "next/link";
import { ArrowRightLeft, Mail, MessageSquare, Phone, Trash2, Users } from "lucide-react";
import type { ActivityType } from "@prisma/client";
import { formatDateTime } from "@/lib/utils";
import { ConfirmSubmit } from "@/components/ui/form";
import { deleteActivityAction } from "@/app/(app)/deals/actions";

const ICONS = { CALL: Phone, MEETING: Users, EMAIL: Mail, NOTE: MessageSquare, STAGE_CHANGE: ArrowRightLeft };

export interface ActivityRow {
  id: string;
  type: ActivityType;
  subject: string;
  body: string | null;
  occurredAt: Date;
  userId: string;
  user: { name: string };
  deal?: { id: string; title: string } | null;
}

export function ActivityList({ items, canDelete }: { items: ActivityRow[]; canDelete: (a: ActivityRow) => boolean }) {
  if (items.length === 0) return <p className="text-sm text-gray-500">No activity yet.</p>;
  return (
    <ol className="space-y-4">
      {items.map((a) => {
        const Icon = ICONS[a.type];
        return (
          <li key={a.id} className="flex gap-3">
            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${a.type === "STAGE_CHANGE" ? "bg-gold-100 text-navy" : "bg-navy-50 text-navy"}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm text-gray-900">{a.subject}</div>
                {a.type !== "STAGE_CHANGE" && canDelete(a) && (
                  <form action={deleteActivityAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <ConfirmSubmit variant="ghost" size="icon" message="Delete this entry?" pendingText="" title="Delete" className="h-6 w-6">
                      <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                    </ConfirmSubmit>
                  </form>
                )}
              </div>
              {a.body && <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-600">{a.body}</p>}
              <div className="text-xs text-gray-400">
                {formatDateTime(a.occurredAt)} by {a.user.name}
                {a.deal && (
                  <>
                    {" · "}
                    <Link href={`/deals/${a.deal.id}`} className="text-navy hover:underline">
                      {a.deal.title}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
