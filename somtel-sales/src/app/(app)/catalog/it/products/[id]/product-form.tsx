"use client";

import { saveProductAction } from "../../actions";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Form, FormMessage, SubmitButton, useActionForm } from "@/components/ui/form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

type Opt = { id: string; name: string };

export function ProductForm({
  values,
  vendors,
  categories,
}: {
  values: { id?: string; vendorId: string; categoryId: string; name?: string; description?: string | null; active: boolean };
  vendors: Opt[];
  categories: Opt[];
}) {
  const form = useActionForm(saveProductAction);
  const fe = form.state.fieldErrors ?? {};
  return (
    <Form form={form}>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Card>
        <CardHeader title="Product details" />
        <CardBody className="space-y-4">
          <FormMessage state={form.state} />
          <Field label="Vendor" htmlFor="vendorId" required error={fe.vendorId}>
            <Select id="vendorId" name="vendorId" defaultValue={values.vendorId} required>
              <option value="">Choose a vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category" htmlFor="categoryId" required error={fe.categoryId}>
            <Select id="categoryId" name="categoryId" defaultValue={values.categoryId} required>
              <option value="">Choose a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Product name" htmlFor="name" required error={fe.name} help="For example FortiGate 60F or UniFi U6 Pro.">
            <Input id="name" name="name" defaultValue={values.name ?? ""} required />
          </Field>
          <Field label="Description" htmlFor="description">
            <Textarea id="description" name="description" defaultValue={values.description ?? ""} />
          </Field>
          {values.id && <Checkbox name="active" label="Active" defaultChecked={values.active} />}
          <SubmitButton>Save product</SubmitButton>
        </CardBody>
      </Card>
    </Form>
  );
}
