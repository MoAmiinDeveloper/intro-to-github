"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { ActionState } from "@/lib/action";
import { planEstimate, type PlanForEstimate } from "@/lib/pipeline";
import { formatMoney } from "@/lib/utils";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Form, FormMessage, SubmitButton, useActionForm } from "@/components/ui/form";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { CatalogOption } from "./form-data";

type Opt = { id: string; name: string };

export interface Line {
  item: string; // "", "plan:<id>" or "sub:<id>"
  description: string;
  quantity: string;
  oneTimeValue: string;
  monthlyValue: string;
}

export interface DealFormValues {
  id?: string;
  title?: string;
  clientId?: string;
  productType?: string;
  stageId?: string;
  oneTimeValue?: string;
  monthlyValue?: string;
  probability?: string;
  expectedCloseDate?: string;
  nextFollowUpAt?: string;
  nextStep?: string | null;
  ownerId?: string;
  lines: Line[];
}

const num = (s: string) => {
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function DealForm({
  action,
  values,
  entities,
  owners,
  catalog,
  stages,
  canAssignOwner,
  cancelHref,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  values: DealFormValues;
  entities: Opt[];
  owners: Opt[];
  catalog: CatalogOption[];
  stages?: { id: string; name: string; probability: number }[];
  canAssignOwner: boolean;
  cancelHref: string;
}) {
  const form = useActionForm(action);
  const fe = form.state.fieldErrors ?? {};
  const [lines, setLines] = useState<Line[]>(values.lines);
  const byValue = useMemo(() => new Map(catalog.map((c) => [c.value, c])), [catalog]);
  const groups = useMemo(() => [...new Set(catalog.map((c) => c.group))], [catalog]);

  const estimate = (item: string, qty: string): { oneTimeValue: string; monthlyValue: string } | null => {
    const plan = byValue.get(item)?.plan;
    if (!plan) return null;
    const e = planEstimate(plan as PlanForEstimate, num(qty));
    return e ? { oneTimeValue: String(e.oneTimeValue), monthlyValue: String(e.monthlyValue) } : null;
  };
  const update = (i: number, patch: Partial<Line>) =>
    setLines((ls) =>
      ls.map((l, j) => {
        if (j !== i) return l;
        const next = { ...l, ...patch };
        if ("item" in patch) next.description = byValue.get(patch.item!)?.description ?? next.description;
        if ("item" in patch || "quantity" in patch) Object.assign(next, estimate(next.item, next.quantity) ?? {});
        return next;
      }),
    );

  const useLines = lines.length > 0;
  const lineTotals = lines.reduce((t, l) => ({ oneTime: t.oneTime + num(l.oneTimeValue), monthly: t.monthly + num(l.monthlyValue) }), { oneTime: 0, monthly: 0 });
  const payload = lines.map((l) => ({
    planId: l.item.startsWith("plan:") ? l.item.slice(5) : null,
    subProductId: l.item.startsWith("sub:") ? l.item.slice(4) : null,
    description: l.description,
    quantity: l.quantity,
    oneTimeValue: l.oneTimeValue,
    monthlyValue: l.monthlyValue,
  }));

  return (
    <Form form={form} className="space-y-5">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="lines" value={JSON.stringify(payload)} />
      <FormMessage state={form.state} />
      <Card>
        <CardHeader title="Deal" />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Field label="Title" htmlFor="title" required error={fe.title} className="md:col-span-2">
            <Input id="title" name="title" defaultValue={values.title ?? ""} required autoFocus placeholder="For example: Firewall for head office" />
          </Field>
          <Field label="Entity" htmlFor="clientId" required error={fe.clientId}>
            <Select id="clientId" name="clientId" defaultValue={values.clientId ?? ""} required>
              <option value="">Choose the entity</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Product type" htmlFor="productType" required error={fe.productType}>
            <Select id="productType" name="productType" defaultValue={values.productType ?? ""} required>
              <option value="">Choose</option>
              <option value="NON_IT">Non-IT (Somtel service)</option>
              <option value="IT">IT (vendor resale)</option>
              <option value="TRACKING">Vehicle tracking</option>
            </Select>
          </Field>
          {stages && (
            <Field label="Stage" htmlFor="stageId">
              <Select id="stageId" name="stageId" defaultValue={values.stageId ?? stages[0]?.id}>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.probability}%)
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Owner" htmlFor="ownerId" help={canAssignOwner ? undefined : "You own the deals you create."}>
            <Select id="ownerId" name="ownerId" defaultValue={values.ownerId ?? ""} disabled={!canAssignOwner}>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Expected close date" htmlFor="expectedCloseDate" error={fe.expectedCloseDate}>
            <Input id="expectedCloseDate" name="expectedCloseDate" type="date" defaultValue={values.expectedCloseDate ?? ""} />
          </Field>
          {values.id && (
            <Field label="Win probability %" htmlFor="probability" error={fe.probability} help="Resets to the stage default when the deal moves.">
              <Input id="probability" name="probability" inputMode="numeric" defaultValue={values.probability ?? ""} className="w-28" />
            </Field>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Products and estimated value"
          description="Add the products the client wants. Somtel service prices are filled in from the catalog; change them if needed. One-time and monthly values are kept apart."
        />
        <CardBody className="space-y-3">
          {lines.length > 0 && (
            <div className="hidden grid-cols-12 gap-2 text-xs font-semibold uppercase text-gray-500 md:grid">
              <div className="col-span-3">Product</div>
              <div className="col-span-3">Description</div>
              <div className="col-span-1">Qty</div>
              <div className="col-span-2">One-time (USD)</div>
              <div className="col-span-2">Monthly (USD)</div>
            </div>
          )}
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-2 items-center gap-2 rounded-md border border-gray-100 p-2 md:grid-cols-12 md:border-0 md:p-0">
              <Select aria-label="Product" value={l.item} onChange={(e) => update(i, { item: e.target.value })} className="col-span-2 md:col-span-3">
                <option value="">Other (type a description)</option>
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {catalog
                      .filter((c) => c.group === g)
                      .map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
              <Input aria-label="Description" value={l.description} onChange={(e) => update(i, { description: e.target.value })} className="col-span-2 md:col-span-3" />
              <Input aria-label="Quantity" value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} inputMode="decimal" className="md:col-span-1" />
              <Input aria-label="One-time value" value={l.oneTimeValue} onChange={(e) => update(i, { oneTimeValue: e.target.value })} inputMode="decimal" className="md:col-span-2" />
              <Input aria-label="Monthly value" value={l.monthlyValue} onChange={(e) => update(i, { monthlyValue: e.target.value })} inputMode="decimal" className="md:col-span-2" />
              <Button type="button" variant="ghost" size="icon" title="Remove line" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {fe.lines && <p className="text-xs text-red-600">{fe.lines}</p>}
          <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { item: "", description: "", quantity: "1", oneTimeValue: "0", monthlyValue: "0" }])}>
            <Plus className="h-3.5 w-3.5" /> Add product
          </Button>

          <div className="grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
            {useLines ? (
              <>
                <div>
                  <div className="text-xs uppercase text-gray-500">One-time value</div>
                  <div className="text-lg font-semibold text-navy">{formatMoney(lineTotals.oneTime)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">Monthly value (MRR)</div>
                  <div className="text-lg font-semibold text-navy">{formatMoney(lineTotals.monthly)}</div>
                </div>
              </>
            ) : (
              <>
                <Field label="One-time value (USD)" htmlFor="oneTimeValue" error={fe.oneTimeValue} help="Setup, hardware, licences.">
                  <Input id="oneTimeValue" name="oneTimeValue" inputMode="decimal" defaultValue={values.oneTimeValue ?? "0"} />
                </Field>
                <Field label="Monthly value (USD)" htmlFor="monthlyValue" error={fe.monthlyValue} help="Recurring monthly services (MRR).">
                  <Input id="monthlyValue" name="monthlyValue" inputMode="decimal" defaultValue={values.monthlyValue ?? "0"} />
                </Field>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Next step" />
        <CardBody className="grid gap-4 md:grid-cols-3">
          <Field label="Next step" htmlFor="nextStep" className="md:col-span-2">
            <Textarea id="nextStep" name="nextStep" defaultValue={values.nextStep ?? ""} className="min-h-[40px]" placeholder="For example: send the proposal after the site visit" />
          </Field>
          <Field label="Next follow-up date" htmlFor="nextFollowUpAt" error={fe.nextFollowUpAt} help="You get a reminder on this day.">
            <Input id="nextFollowUpAt" name="nextFollowUpAt" type="date" defaultValue={values.nextFollowUpAt ?? ""} />
          </Field>
        </CardBody>
      </Card>

      <div className="flex gap-2">
        <SubmitButton>{values.id ? "Save deal" : "Create deal"}</SubmitButton>
        <Link href={cancelHref} className={buttonClass("outline")}>
          Cancel
        </Link>
      </div>
    </Form>
  );
}
