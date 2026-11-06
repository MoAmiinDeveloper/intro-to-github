"use client";

import { useEffect, useRef } from "react";
import { saveVendorAction, saveVendorDistributorAction } from "../../it/actions";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Form, FormMessage, SubmitButton, useActionForm } from "@/components/ui/form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export function VendorForm({ values }: { values: { id?: string; name?: string; website?: string | null; notes?: string | null; active: boolean } }) {
  const form = useActionForm(saveVendorAction);
  const fe = form.state.fieldErrors ?? {};
  return (
    <Form form={form}>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Card>
        <CardHeader title="Vendor details" />
        <CardBody className="space-y-4">
          <FormMessage state={form.state} />
          <Field label="Name" htmlFor="name" required error={fe.name}>
            <Input id="name" name="name" defaultValue={values.name ?? ""} required />
          </Field>
          <Field label="Website" htmlFor="website">
            <Input id="website" name="website" defaultValue={values.website ?? ""} />
          </Field>
          <Field label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={values.notes ?? ""} />
          </Field>
          {values.id && <Checkbox name="active" label="Active" defaultChecked={values.active} />}
          <SubmitButton>Save vendor</SubmitButton>
        </CardBody>
      </Card>
    </Form>
  );
}

/** Link a distributor to this vendor (or update the link details). */
export function VendorDistributorForm({ vendorId, distributors, linkedIds }: { vendorId: string; distributors: { id: string; name: string }[]; linkedIds: string[] }) {
  const form = useActionForm(saveVendorDistributorAction);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (form.state.ok) ref.current?.reset();
  }, [form.state]);
  if (distributors.length === 0) return <p className="text-sm text-gray-500">Add distributors first on the Distributors tab.</p>;
  return (
    <Form form={form} ref={ref} className="space-y-3">
      <input type="hidden" name="vendorId" value={vendorId} />
      <div className="text-sm font-medium text-gray-700">Add or update a distributor</div>
      <FormMessage state={form.state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select name="distributorId" aria-label="Distributor" required defaultValue="">
          <option value="">Choose a distributor</option>
          {distributors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {linkedIds.includes(d.id) ? " (linked, update details)" : ""}
            </option>
          ))}
        </Select>
        <Input name="partnerLevel" placeholder="Partner level (optional)" />
        <Input name="accountNumber" placeholder="Our account number (optional)" />
        <Input name="notes" placeholder="Notes (optional)" />
      </div>
      <SubmitButton size="sm">Save link</SubmitButton>
    </Form>
  );
}
