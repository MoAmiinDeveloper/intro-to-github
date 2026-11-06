"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveDealAction } from "../deals/actions";
import { cn, formatMoney, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface BoardDeal {
  id: string;
  title: string;
  clientName: string;
  ownerName: string;
  productType: "IT" | "NON_IT" | "TRACKING";
  oneTime: number;
  monthly: number;
  probability: number;
  closeDate: string | null;
  staleDays: number | null;
  followUp: "overdue" | "today" | null;
}

export interface BoardColumn {
  id: string;
  name: string;
  kind: "OPEN" | "WON" | "LOST";
  probability: number;
  deals: BoardDeal[];
}

const TYPE = { IT: "IT", NON_IT: "Non-IT", TRACKING: "Tracking" } as const;
const TONE = { IT: "blue", NON_IT: "navy", TRACKING: "amber" } as const;

function sum(deals: BoardDeal[]) {
  return deals.reduce(
    (t, d) => ({ oneTime: t.oneTime + d.oneTime, monthly: t.monthly + d.monthly, wOne: t.wOne + (d.oneTime * d.probability) / 100, wMon: t.wMon + (d.monthly * d.probability) / 100 }),
    { oneTime: 0, monthly: 0, wOne: 0, wMon: 0 },
  );
}

export function PipelineBoard({ columns: initial, lostReasons, closedDays }: { columns: BoardColumn[]; lostReasons: { id: string; name: string }[]; closedDays: number }) {
  const router = useRouter();
  const [columns, setColumns] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lost, setLost] = useState<{ dealId: string; stageId: string } | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => setColumns(initial), [initial]);

  const locate = (dealId: string) => {
    for (const c of columns) {
      const d = c.deals.find((x) => x.id === dealId);
      if (d) return { col: c, deal: d };
    }
    return null;
  };

  const doMove = (dealId: string, stageId: string, lostReasonId?: string, lostNote?: string) => {
    const from = locate(dealId);
    const to = columns.find((c) => c.id === stageId);
    if (!from || !to || from.col.id === stageId) return;
    const snapshot = columns;
    // Move the card at once; undo if the server says no.
    setColumns((cols) =>
      cols.map((c) =>
        c.id === from.col.id
          ? { ...c, deals: c.deals.filter((d) => d.id !== dealId) }
          : c.id === stageId
            ? { ...c, deals: [{ ...from.deal, probability: to.probability, staleDays: null }, ...c.deals] }
            : c,
      ),
    );
    start(async () => {
      setError(null);
      const res = await moveDealAction({ dealId, stageId, lostReasonId, lostNote });
      if (res.error) {
        setColumns(snapshot);
        setError(res.error);
      } else {
        setLost(null);
        setReason("");
        setNote("");
        router.refresh();
      }
    });
  };

  const onDrop = (stageId: string) => {
    setOverCol(null);
    if (!dragId) return;
    const target = columns.find((c) => c.id === stageId);
    if (target?.kind === "LOST") setLost({ dealId: dragId, stageId });
    else doMove(dragId, stageId);
    setDragId(null);
  };

  const lostDeal = lost ? locate(lost.dealId)?.deal : null;

  return (
    <div>
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-3 overflow-x-auto pb-4" data-testid="board">
        {columns.map((c) => {
          const t = sum(c.deals);
          return (
            <div
              key={c.id}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(c.id);
              }}
              onDragLeave={() => setOverCol((o) => (o === c.id ? null : o))}
              onDrop={() => onDrop(c.id)}
              data-stage={c.name}
              className={cn(
                "flex flex-col rounded-lg border bg-gray-100/70",
                c.kind === "OPEN" ? "min-w-[190px] flex-1 basis-0" : "w-40 shrink-0",
                overCol === c.id ? "border-gold ring-2 ring-gold" : "border-gray-200",
              )}
            >
              <div className={cn("rounded-t-lg border-b-4 bg-white px-3 py-2", c.kind === "WON" ? "border-green-500" : c.kind === "LOST" ? "border-red-500" : "border-navy")}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-navy">{c.name}</span>
                  <span className="text-xs text-gray-500">
                    {c.deals.length} · {c.probability}%
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  {formatMoney(t.oneTime)}
                  {c.kind === "OPEN" ? " one-time" : ""} · {formatMoney(t.monthly)}/mo
                </div>
                {c.kind === "OPEN" && (
                  <div className="text-xs text-gray-400">
                    Weighted {formatMoney(t.wOne)} · {formatMoney(t.wMon)}/mo
                  </div>
                )}
                {c.kind !== "OPEN" && <div className="text-xs text-gray-400">Last {closedDays} days</div>}
              </div>
              <div className="flex min-h-[120px] flex-1 flex-col gap-2 p-2">
                {c.kind !== "OPEN" &&
                  c.deals.map((d) => (
                    <div
                      key={d.id}
                      draggable
                      onDragStart={() => setDragId(d.id)}
                      onDragEnd={() => setDragId(null)}
                      className={cn("cursor-grab rounded border border-gray-200 bg-white px-2 py-1.5 text-xs shadow-sm", dragId === d.id && "opacity-50")}
                    >
                      <Link href={`/deals/${d.id}`} className="block truncate font-medium text-navy hover:underline" draggable={false} title={d.title}>
                        {d.title}
                      </Link>
                      <div className="truncate text-gray-500">{d.clientName}</div>
                    </div>
                  ))}
                {c.kind === "OPEN" && c.deals.map((d) => (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={() => setDragId(d.id)}
                    onDragEnd={() => setDragId(null)}
                    className={cn("cursor-grab rounded-md border border-gray-200 bg-white p-3 shadow-sm active:cursor-grabbing", dragId === d.id && "opacity-50")}
                  >
                    <Link href={`/deals/${d.id}`} className="block text-sm font-medium text-navy hover:underline" draggable={false}>
                      {d.title}
                    </Link>
                    <div className="truncate text-xs text-gray-500">{d.clientName}</div>
                    <div className="mt-2 text-xs text-gray-800">
                      {d.oneTime > 0 && <span>{formatMoney(d.oneTime)}</span>}
                      {d.oneTime > 0 && d.monthly > 0 && <span> + </span>}
                      {d.monthly > 0 && <span>{formatMoney(d.monthly)}/mo</span>}
                      {d.oneTime === 0 && d.monthly === 0 && <span className="text-gray-400">No value yet</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <Badge tone={TONE[d.productType]}>{TYPE[d.productType]}</Badge>
                      {d.staleDays !== null && <Badge tone="amber">Stale {d.staleDays}d</Badge>}
                      {d.followUp === "overdue" && <Badge tone="red">Follow-up overdue</Badge>}
                      {d.followUp === "today" && <Badge tone="gold">Follow-up today</Badge>}
                      <span className="ml-auto flex items-center gap-1 text-[11px] text-gray-500">
                        {d.closeDate && <span>{d.closeDate}</span>}
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[9px] font-semibold text-gold" title={d.ownerName}>
                          {initials(d.ownerName)}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {lost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-4 rounded-lg bg-white p-5 shadow-xl">
            <div>
              <h2 className="text-lg font-semibold text-navy">Mark as lost</h2>
              <p className="text-sm text-gray-500">{lostDeal?.title}</p>
            </div>
            <Field label="Lost reason" htmlFor="board-lost-reason" required>
              <Select id="board-lost-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Choose a reason</option>
                {lostReasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Note" htmlFor="board-lost-note" help="Required when the reason is Other.">
              <Input id="board-lost-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setLost(null);
                  setError(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" disabled={pending} onClick={() => (reason ? doMove(lost.dealId, lost.stageId, reason, note) : setError("Choose why the deal was lost."))}>
                {pending ? "Saving..." : "Mark as lost"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
