"use client";

import Link from "next/link";
import { useState } from "react";
import { saveSubProductAction } from "../../actions";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Form, FormMessage, SubmitButton, useActionForm } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

interface Values {
  id?: string;
  name?: string;
  sku?: string | null;
  kind: string;
  quoteDescription?: string | null;
  unitLabel?: string | null;
  termMonths: string;
  markupPct: string;
  active: boolean;
}

export function SubProductForm({ productId, values, defaults }: { productId: string; values: Values; defaults: { hardware: number; software: number } }) {
  const form = useActionForm(saveSubProductAction);
  const fe = form.state.fieldErrors ?? {};
  const [kind, setKind] = useState(values.kind);
  return (
    <Form form={form}>
      <input type="hidden" name="productId" value={productId} />
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Card>
        <CardHeader title={values.id ? "Edit sub-product" : "New sub-product"} />
        <CardBody className="space-y-4">
          <FormMessage state={form.state} />
          <Field label="Type" htmlFor="kind" required error={fe.kind}>
            <Select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="HARDWARE">Hardware (customs can apply)</option>
              <option value="SOFTWARE">Software or licence (no customs)</option>
            </Select>
          </Field>
          <Field label="Name" htmlFor="name" required error={fe.name} help={kind === "HARDWARE" ? "For example FG-60F appliance." : "For example FortiGuard UTP, 1 year."}>
            <Input id="name" name="name" defaultValue={values.name ?? ""} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Part number (SKU)" htmlFor="sku" error={fe.sku}>
              <Input id="sku" name="sku" defaultValue={values.sku ?? ""} className="font-mono" />
            </Field>
            <Field label="Unit" htmlFor="unitLabel" help='For example "device", "user", "licence".'>
              <Input id="unitLabel" name="unitLabel" defaultValue={values.unitLabel ?? ""} />
            </Field>
            {kind === "SOFTWARE" && (
              <Field label="Term (months)" htmlFor="termMonths" error={fe.termMonths} help="Used for renewal alerts.">
                <Input id="termMonths" name="termMonths" inputMode="numeric" defaultValue={values.termMonths} />
              </Field>
            )}
            <Field
              label="Markup %"
              htmlFor="markupPct"
              error={fe.markupPct}
              help={`Leave empty to use the default (${kind === "HARDWARE" ? defaults.hardware : defaults.software}%). Sales can still change it per quote line.`}
            >
              <Input id="markupPct" name="markupPct" inputMode="decimal" defaultValue={values.markupPct} placeholder="Default" />
            </Field>
          </div>
          <Field label="Text on the client quote" htmlFor="quoteDescription" help="What the client sees in the Description column.">
            <Textarea id="quoteDescription" name="quoteDescription" defaultValue={values.quoteDescription ?? ""} className="min-h-[60px]" />
          </Field>
          {values.id && <Checkbox name="active" label="Active" defaultChecked={values.active} />}
          <div className="flex gap-2">
            <SubmitButton>Save sub-product</SubmitButton>
            <Link href={values.id ? `/catalog/it/sub-products/${values.id}` : `/catalog/it/products/${productId}`} className={buttonClass("outline")}>
              Cancel
            </Link>
          </div>
        </CardBody>
      </Card>
    </Form>
  );
}
