"use client";

import Link from "next/link";

import { saveFamilyAction } from "../../actions";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export function FamilyForm({ values }: { values: { id?: string; name?: string; description?: string | null; enabled: boolean; sortOrder: number } }) {
  const form = useActionForm(saveFamilyAction);
  const state = form.state;
  return (
    <Form form={form}>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Card>
        <CardBody className="space-y-4">
          <FormMessage state={state} />
          <Field label="Name" htmlFor="name" required error={state.fieldErrors?.name}>
            <Input id="name" name="name" defaultValue={values.name ?? ""} required />
          </Field>
          <Field label="Description" htmlFor="description">
            <Textarea id="description" name="description" defaultValue={values.description ?? ""} />
          </Field>
          <Field label="Sort order" htmlFor="sortOrder" help="Lower numbers show first.">
            <Input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={values.sortOrder} className="w-32" />
          </Field>
          <Checkbox name="enabled" label="Switched on (visible to sales)" defaultChecked={values.enabled} />
          <div className="flex gap-2">
            <SubmitButton>Save</SubmitButton>
            <Link href="/catalog" className={buttonClass("outline")}>
              Cancel
            </Link>
          </div>
        </CardBody>
      </Card>
    </Form>
  );
}
