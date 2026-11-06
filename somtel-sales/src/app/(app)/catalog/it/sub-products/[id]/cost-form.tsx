"use client";

import { useEffect, useRef, useState } from "react";
import { recordCostAction } from "../../actions";
import { CURRENCIES } from "@/lib/it-catalog";
import { Field, Input, Select } from "@/components/ui/input";
import { Form, FormMessage, SubmitButton, useActionForm } from "@/components/ui/form";

export function CostForm({ subProductId, distributors }: { subProductId: string; distributors: { id: string; name: string; currency: string }[] }) {
  const form = useActionForm(recordCostAction);
  const fe = form.state.fieldErrors ?? {};
  const ref = useRef<HTMLFormElement>(null);
  const [distributorId, setDistributorId] = useState(distributors[0]?.id ?? "");
  const [currency, setCurrency] = useState(distributors[0]?.currency ?? "USD");
  useEffect(() => {
    if (form.state.ok) ref.current?.reset();
  }, [form.state]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Form form={form} ref={ref} className="space-y-4">
      <input type="hidden" name="subProductId" value={subProductId} />
      <FormMessage state={form.state} />
      <Field label="Distributor" htmlFor="distributorId" error={fe.distributorId}>
        <Select
          id="distributorId"
          name="distributorId"
          value={distributorId}
          onChange={(e) => {
            setDistributorId(e.target.value);
            setCurrency(distributors.find((d) => d.id === e.target.value)?.currency ?? "USD");
          }}
        >
          {distributors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Unit cost" htmlFor="unitCost" required error={fe.unitCost}>
          <Input id="unitCost" name="unitCost" inputMode="decimal" required />
        </Field>
        <Field label="Currency" htmlFor="currency" error={fe.currency}>
          <Select id="currency" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        {currency !== "USD" && (
          <Field label={`1 USD = ? ${currency}`} htmlFor="exchangeRate" required error={fe.exchangeRate}>
            <Input id="exchangeRate" name="exchangeRate" inputMode="decimal" defaultValue={currency === "AED" ? "3.6725" : ""} required />
          </Field>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Quote date" htmlFor="quotedAt" error={fe.quotedAt}>
          <Input id="quotedAt" name="quotedAt" type="date" defaultValue={today} max={today} required />
        </Field>
        <Field label="Quote / PI number" htmlFor="reference">
          <Input id="reference" name="reference" />
        </Field>
      </div>
      <SubmitButton>Record cost</SubmitButton>
    </Form>
  );
}
