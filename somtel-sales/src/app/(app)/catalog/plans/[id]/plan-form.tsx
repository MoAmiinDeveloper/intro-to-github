"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { savePlanAction } from "../../actions";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { PRICE_TYPE_LABELS } from "@/lib/pricing";

type TierRow = { fromQty: string; toQty: string; unitPrice: string };

interface Values {
  id?: string;
  name?: string;
  description?: string | null;
  priceType: string;
  billingFrequency: string;
  unitPrice?: string;
  unitLabel?: string | null;
  includedUnits?: string;
  includedLabel?: string | null;
  marginPct?: string;
  active: boolean;
  sortOrder: number;
  tiers: TierRow[];
}

export function PlanForm({ serviceId, values }: { serviceId: string; values: Values }) {
  const form = useActionForm(savePlanAction);
  const state = form.state;
  const [priceType, setPriceType] = useState(values.priceType);
  const [tiers, setTiers] = useState<TierRow[]>(values.tiers.length ? values.tiers : [{ fromQty: "1", toQty: "", unitPrice: "" }]);
  const fe = state.fieldErrors ?? {};

  const isTiered = priceType === "PER_SMS_TIERED";
  const isMargin = priceType === "MARGIN_PERCENT";
  const fixedFrequency = priceType === "MONTHLY" ? "MONTHLY" : priceType === "ONE_TIME" ? "ONE_TIME" : null;

  const updateTier = (i: number, key: keyof TierRow, v: string) => setTiers((t) => t.map((row, j) => (j === i ? { ...row, [key]: v } : row)));
  const addTier = () =>
    setTiers((t) => {
      const last = t[t.length - 1];
      const nextFrom = last && last.toQty ? String(Number(last.toQty) + 1) : "";
      return [...t, { fromQty: nextFrom, toQty: "", unitPrice: "" }];
    });

  return (
    <Form form={form}>
      <input type="hidden" name="serviceId" value={serviceId} />
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="tiers" value={JSON.stringify(isTiered ? tiers : [])} />
      <Card>
        <CardBody className="space-y-4">
          <FormMessage state={state} />
          <Field label="Plan name" htmlFor="name" required error={fe.name}>
            <Input id="name" name="name" defaultValue={values.name ?? ""} required />
          </Field>
          <Field label="Description" htmlFor="description">
            <Textarea id="description" name="description" defaultValue={values.description ?? ""} className="min-h-[60px]" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price type" htmlFor="priceType">
              <Select id="priceType" name="priceType" value={priceType} onChange={(e) => setPriceType(e.target.value)}>
                {Object.entries(PRICE_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Billed" htmlFor="billingFrequency" help="Used to report one-time revenue and MRR separately.">
              {fixedFrequency ? (
                <>
                  <input type="hidden" name="billingFrequency" value={fixedFrequency} />
                  <Input value={fixedFrequency === "MONTHLY" ? "Monthly" : "One-time"} disabled />
                </>
              ) : (
                <Select id="billingFrequency" name="billingFrequency" defaultValue={values.billingFrequency}>
                  <option value="ONE_TIME">One-time</option>
                  <option value="MONTHLY">Monthly</option>
                </Select>
              )}
            </Field>
          </div>

          {!isTiered && !isMargin && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Price (USD)" htmlFor="unitPrice" required error={fe.unitPrice}>
                <Input id="unitPrice" name="unitPrice" inputMode="decimal" defaultValue={values.unitPrice ?? ""} placeholder="0.00" />
              </Field>
              <Field label="Unit name" htmlFor="unitLabel" help='For example "vehicle", "device", "extension".'>
                <Input id="unitLabel" name="unitLabel" defaultValue={values.unitLabel ?? ""} />
              </Field>
              <Field label="Included units" htmlFor="includedUnits" error={fe.includedUnits} help="Optional. For example 4.">
                <Input id="includedUnits" name="includedUnits" inputMode="numeric" defaultValue={values.includedUnits ?? ""} />
              </Field>
              <Field label="Included units name" htmlFor="includedLabel" help='For example "IVR extensions".'>
                <Input id="includedLabel" name="includedLabel" defaultValue={values.includedLabel ?? ""} />
              </Field>
            </div>
          )}

          {isMargin && (
            <Field
              label="Markup % on supplier cost"
              htmlFor="marginPct"
              error={fe.marginPct}
              help="Leave empty to use the default from settings (10% licences, 20% hardware). Sales can change it per line."
            >
              <Input id="marginPct" name="marginPct" inputMode="decimal" defaultValue={values.marginPct ?? ""} className="w-40" />
            </Field>
          )}

          {isTiered && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Volume bands</div>
              <p className="text-xs text-gray-500">
                All units are charged at the rate of the band the total falls in. Leave &quot;To&quot; empty on the last band for no upper limit.
              </p>
              <div className="space-y-2">
                {tiers.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input aria-label="From" value={t.fromQty} onChange={(e) => updateTier(i, "fromQty", e.target.value)} placeholder="From" className="w-32" inputMode="numeric" />
                    <span className="text-sm text-gray-500">to</span>
                    <Input aria-label="To" value={t.toQty} onChange={(e) => updateTier(i, "toQty", e.target.value)} placeholder="No limit" className="w-32" inputMode="numeric" />
                    <span className="text-sm text-gray-500">at $</span>
                    <Input aria-label="Price" value={t.unitPrice} onChange={(e) => updateTier(i, "unitPrice", e.target.value)} placeholder="0.00" className="w-28" inputMode="decimal" />
                    {tiers.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => setTiers((r) => r.filter((_, j) => j !== i))} title="Remove band">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addTier}>
                <Plus className="h-3.5 w-3.5" /> Add band
              </Button>
              {fe.tiers && <p className="text-xs text-red-600">{fe.tiers}</p>}
            </div>
          )}

          <div className="flex items-end gap-6">
            <Field label="Sort order" htmlFor="sortOrder">
              <Input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={values.sortOrder} className="w-28" />
            </Field>
            <Checkbox name="active" label="Active" defaultChecked={values.active} className="pb-2" />
          </div>
          <div className="flex gap-2">
            <SubmitButton>Save plan</SubmitButton>
            <Link href={`/catalog/services/${serviceId}`} className={buttonClass("outline")}>
              Cancel
            </Link>
          </div>
        </CardBody>
      </Card>
    </Form>
  );
}
