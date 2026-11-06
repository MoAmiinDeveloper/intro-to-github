"use client";

import { saveCompanyAction } from "./actions";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

type Values = Partial<Record<"name" | "legalName" | "address" | "city" | "phone" | "email" | "website" | "footerText", string | null>> & { hasCustomLogo: boolean };

export function CompanyForm({ values }: { values: Values }) {
  const form = useActionForm(saveCompanyAction);
  const state = form.state;
  const fe = state.fieldErrors ?? {};
  const text = (k: keyof Omit<Values, "hasCustomLogo">) => values[k] ?? "";
  return (
    <Form form={form} className="space-y-5">
      <FormMessage state={state} />
      <Card>
        <CardHeader title="Logo" description="Shown in the sidebar, on the login page, and on quotes and reports. PNG, JPG, SVG or WEBP, up to 2 MB." />
        <CardBody className="flex flex-wrap items-center gap-6">
          <div className="flex h-20 w-48 items-center justify-center rounded border border-gray-200 bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/branding/logo?v=${Date.now()}`} alt="Current logo" className="max-h-full max-w-full" />
          </div>
          <div className="space-y-2">
            <Input type="file" name="logo" accept=".png,.jpg,.jpeg,.svg,.webp" className="h-auto py-1.5" />
            {fe.logo && <p className="text-xs text-red-600">{fe.logo}</p>}
            {values.hasCustomLogo && <Checkbox name="resetLogo" label="Go back to the default logo" />}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Company details" description="Used in document headers and footers." />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Field label="Company name" htmlFor="name" required error={fe.name}>
            <Input id="name" name="name" defaultValue={text("name")} required />
          </Field>
          <Field label="Legal name" htmlFor="legalName">
            <Input id="legalName" name="legalName" defaultValue={text("legalName")} />
          </Field>
          <Field label="Address" htmlFor="address">
            <Input id="address" name="address" defaultValue={text("address")} />
          </Field>
          <Field label="City" htmlFor="city">
            <Input id="city" name="city" defaultValue={text("city")} />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={text("phone")} />
          </Field>
          <Field label="Email" htmlFor="email" error={fe.email}>
            <Input id="email" name="email" defaultValue={text("email")} />
          </Field>
          <Field label="Website" htmlFor="website">
            <Input id="website" name="website" defaultValue={text("website")} />
          </Field>
          <Field label="Document footer" htmlFor="footerText" className="md:col-span-2">
            <Textarea id="footerText" name="footerText" defaultValue={text("footerText")} className="min-h-[60px]" />
          </Field>
        </CardBody>
      </Card>
      <SubmitButton>Save</SubmitButton>
    </Form>
  );
}
