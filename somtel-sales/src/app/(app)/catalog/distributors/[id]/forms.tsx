"use client";

import { useEffect, useRef } from "react";
import { addDistributorContactAction, saveDistributorAction } from "../../it/actions";
import { CURRENCIES } from "@/lib/it-catalog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Form, FormMessage, SubmitButton, useActionForm } from "@/components/ui/form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

type Values = {
  id?: string;
  name?: string;
  country?: string | null;
  currency: string;
  paymentTerms?: string | null;
  remittanceNotes?: string | null;
  website?: string | null;
  notes?: string | null;
  active: boolean;
};

export function DistributorForm({ values }: { values: Values }) {
  const form = useActionForm(saveDistributorAction);
  const fe = form.state.fieldErrors ?? {};
  return (
    <Form form={form}>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Card>
        <CardHeader title="Distributor details" />
        <CardBody className="space-y-4">
          <FormMessage state={form.state} />
          <Field label="Name" htmlFor="name" required error={fe.name}>
            <Input id="name" name="name" defaultValue={values.name ?? ""} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Country" htmlFor="country">
              <Input id="country" name="country" defaultValue={values.country ?? ""} placeholder="For example United Arab Emirates" />
            </Field>
            <Field label="Usual quote currency" htmlFor="currency" error={fe.currency}>
              <Select id="currency" name="currency" defaultValue={values.currency}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Payment terms" htmlFor="paymentTerms">
            <Input id="paymentTerms" name="paymentTerms" defaultValue={values.paymentTerms ?? ""} placeholder="For example 100% advance" />
          </Field>
          <Field label="Remittance and bank notes" htmlFor="remittanceNotes">
            <Textarea id="remittanceNotes" name="remittanceNotes" defaultValue={values.remittanceNotes ?? ""} className="min-h-[60px]" />
          </Field>
          <Field label="Website" htmlFor="website">
            <Input id="website" name="website" defaultValue={values.website ?? ""} />
          </Field>
          <Field label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={values.notes ?? ""} className="min-h-[60px]" />
          </Field>
          {values.id && <Checkbox name="active" label="Active" defaultChecked={values.active} />}
          <SubmitButton>Save distributor</SubmitButton>
        </CardBody>
      </Card>
    </Form>
  );
}

export function DistributorContactForm({ distributorId }: { distributorId: string }) {
  const form = useActionForm(addDistributorContactAction);
  const fe = form.state.fieldErrors ?? {};
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (form.state.ok) ref.current?.reset();
  }, [form.state]);
  return (
    <Form form={form} ref={ref} className="space-y-3">
      <input type="hidden" name="distributorId" value={distributorId} />
      <div className="text-sm font-medium text-gray-700">Add a contact</div>
      <FormMessage state={form.state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="name" placeholder="Name" required aria-label="Name" />
        <Input name="title" placeholder="Job title" aria-label="Job title" />
        <Input name="phone" placeholder="Phone" aria-label="Phone" />
        <Input name="email" type="email" placeholder="Email" aria-label="Email" />
      </div>
      {fe.phone && <p className="text-xs text-red-600">{fe.phone}</p>}
      <SubmitButton size="sm">Add contact</SubmitButton>
    </Form>
  );
}
