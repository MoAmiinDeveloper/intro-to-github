"use client";

import { saveServiceAction } from "../../actions";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

interface Values {
  id?: string;
  familyId: string;
  name?: string;
  description?: string | null;
  vendor?: string | null;
  productType: string;
  itemKind: string;
  options: string[];
  active: boolean;
  sortOrder: number;
  techSectionIds: string[];
}

export function ServiceForm({
  values,
  families,
  techSections,
}: {
  values: Values;
  families: { id: string; name: string }[];
  techSections: { id: string; name: string }[];
}) {
  const form = useActionForm(saveServiceAction);
  const state = form.state;
  const fe = state.fieldErrors ?? {};
  return (
    <Form form={form}>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Card>
        <CardHeader title="Service details" />
        <CardBody className="space-y-4">
          <FormMessage state={state} />
          <Field label="Family" htmlFor="familyId" required error={fe.familyId}>
            <Select id="familyId" name="familyId" defaultValue={values.familyId}>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Service name" htmlFor="name" required error={fe.name}>
            <Input id="name" name="name" defaultValue={values.name ?? ""} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product type" htmlFor="productType" help="IT is vendor resale. Non-IT is a Somtel service.">
              <Select id="productType" name="productType" defaultValue={values.productType}>
                <option value="NON_IT">Non-IT (Somtel service)</option>
                <option value="IT">IT (vendor resale)</option>
                <option value="TRACKING">Vehicle tracking</option>
              </Select>
            </Field>
            <Field label="Item kind" htmlFor="itemKind" help="Hardware lines can have customs. Licences cannot.">
              <Select id="itemKind" name="itemKind" defaultValue={values.itemKind}>
                <option value="SERVICE">Service</option>
                <option value="LICENCE">Licence</option>
                <option value="HARDWARE">Hardware</option>
              </Select>
            </Field>
          </div>
          <Field label="Vendor" htmlFor="vendor" help="For resale items, for example the brand you buy from.">
            <Input id="vendor" name="vendor" defaultValue={values.vendor ?? ""} />
          </Field>
          <Field label="Description" htmlFor="description">
            <Textarea id="description" name="description" defaultValue={values.description ?? ""} />
          </Field>
          <Field label="Service options" htmlFor="options" help="One per line. For example the service shapes a client can choose.">
            <Textarea id="options" name="options" defaultValue={values.options.join("\n")} />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-700">Tech sections responsible for activation</legend>
            {techSections.length === 0 && <p className="text-xs text-gray-500">No tech sections yet. Add them in Settings.</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {techSections.map((t) => (
                <Checkbox key={t.id} name="techSectionIds" value={t.id} label={t.name} defaultChecked={values.techSectionIds.includes(t.id)} />
              ))}
            </div>
          </fieldset>
          <div className="flex items-end gap-6">
            <Field label="Sort order" htmlFor="sortOrder">
              <Input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={values.sortOrder} className="w-28" />
            </Field>
            <Checkbox name="active" label="Active" defaultChecked={values.active} className="pb-2" />
          </div>
          <SubmitButton>Save service</SubmitButton>
        </CardBody>
      </Card>
    </Form>
  );
}
