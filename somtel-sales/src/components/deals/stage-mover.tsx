"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { moveDealAction } from "@/app/(app)/deals/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

export type StageOpt = { id: string; name: string; kind: "OPEN" | "WON" | "LOST"; probability: number };

/** Clickable stage bar on the deal page. Lost asks for a reason first. */
export function StageMover({
  dealId,
  stageId,
  stages,
  lostReasons,
  editable,
}: {
  dealId: string;
  stageId: string;
  stages: StageOpt[];
  lostReasons: { id: string; name: string }[];
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [askLost, setAskLost] = useState<StageOpt | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const currentIndex = stages.findIndex((s) => s.id === stageId);
  const current = stages[currentIndex];

  const move = (to: StageOpt, lostReasonId?: string, lostNote?: string) =>
    start(async () => {
      setError(null);
      const res = await moveDealAction({ dealId, stageId: to.id, lostReasonId, lostNote });
      if (res.error) setError(res.error);
      else {
        setAskLost(null);
        router.refresh();
      }
    });

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {stages.map((s, i) => {
          const isCurrent = s.id === stageId;
          const done = current?.kind === "OPEN" ? i < currentIndex && s.kind === "OPEN" : current?.kind === "WON" && s.kind !== "LOST";
          return (
            <button
              key={s.id}
              type="button"
              disabled={!editable || pending || isCurrent}
              onClick={() => (s.kind === "LOST" ? setAskLost(s) : move(s))}
              className={cn(
                "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors",
                isCurrent && s.kind === "WON" && "bg-green-600 font-semibold text-white",
                isCurrent && s.kind === "LOST" && "bg-red-600 font-semibold text-white",
                isCurrent && s.kind === "OPEN" && "bg-gold font-semibold text-navy",
                !isCurrent && done && "bg-navy text-white",
                !isCurrent && !done && "bg-gray-100 text-gray-600",
                editable && !isCurrent && "hover:ring-2 hover:ring-navy-200",
                !editable && "cursor-default",
              )}
              title={editable && !isCurrent ? `Move to ${s.name}` : undefined}
            >
              {done && <Check className="h-3.5 w-3.5" />}
              {s.name}
              <span className="text-xs opacity-75">{s.probability}%</span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {askLost && (
        <div className="mt-3 space-y-3 rounded-md border border-red-200 bg-red-50 p-4">
          <div className="text-sm font-medium text-red-800">Why was this deal lost?</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Lost reason" htmlFor="lostReasonId" required>
              <Select id="lostReasonId" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Choose a reason</option>
                {lostReasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Note" htmlFor="lostNote" help="Required when the reason is Other.">
              <Input id="lostNote" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="danger" size="sm" disabled={pending} onClick={() => move(askLost, reason, note)}>
              {pending ? "Saving..." : "Mark as lost"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAskLost(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
