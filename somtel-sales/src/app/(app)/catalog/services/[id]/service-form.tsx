"use client";

import { saveServiceAction } from "../../actions";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

interface Values {
  id?: string;
  categoryId: string;
  name?: string;
  description?: string | null;
  productType: string;
  options: string[];
  active: boolean;
  sortOrder: number;
  techSectionIds: string[];
}

export function ServiceForm({
  values,
  categories,
  techSections,
}: {
  values: Values;
  categories: { id: string; name: string }[];
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
          <Field label="Category" htmlFor="categoryId" required error={fe.categoryId}>
            <Select id="categoryId" name="categoryId" defaultValue={values.categoryId}>
              {categories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Service name" htmlFor="name" required error={fe.name}>
            <Input id="name" name="name" defaultValue={values.name ?? ""} required />
          </Field>
          <Field label="Type" htmlFor="productType" help="IT products from vendors are in the IT catalog, not here.">
            <Select id="productType" name="productType" defaultValue={values.productType}>
              <option value="NON_IT">Non-IT (Somtel service)</option>
              <option value="TRACKING">Vehicle tracking</option>
            </Select>
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
