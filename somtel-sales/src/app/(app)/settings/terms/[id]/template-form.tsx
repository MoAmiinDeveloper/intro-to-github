"use client";

import Link from "next/link";

import { saveTemplateAction } from "../actions";
import { TERMS_CATEGORY_LABELS } from "../labels";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export function TemplateForm({ values }: { values: { id?: string; name?: string; category: string; body?: string; active: boolean } }) {
  const form = useActionForm(saveTemplateAction);
  const state = form.state;
  const fe = state.fieldErrors ?? {};
  return (
    <Form form={form}>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Card>
        <CardBody className="space-y-4">
          <FormMessage state={state} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="name" required error={fe.name}>
              <Input id="name" name="name" defaultValue={values.name ?? ""} required />
            </Field>
            <Field label="Used for" htmlFor="category">
              <Select id="category" name="category" defaultValue={values.category}>
                {Object.entries(TERMS_CATEGORY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Terms" htmlFor="body" required error={fe.body} help="Plain text. Put each term on its own line. Lines starting with a number or dash become a list on the document.">
            <Textarea id="body" name="body" defaultValue={values.body ?? ""} className="min-h-[320px] font-mono text-[13px]" />
          </Field>
          {values.id && <Checkbox name="active" label="Active (can be picked on new quotes)" defaultChecked={values.active} />}
          <div className="flex gap-2">
            <SubmitButton>Save template</SubmitButton>
            <Link href="/settings/terms" className={buttonClass("outline")}>
              Cancel
            </Link>
          </div>
        </CardBody>
      </Card>
    </Form>
  );
}
