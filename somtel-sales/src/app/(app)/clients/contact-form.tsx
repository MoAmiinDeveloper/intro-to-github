"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { saveContactAction } from "./actions";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";

export interface ContactValues {
  id?: string;
  name?: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  isDecisionMaker?: boolean;
  notes?: string | null;
}

export function ContactForm({ clientId, values = {}, cancelHref }: { clientId: string; values?: ContactValues; cancelHref?: string }) {
  const form = useActionForm(saveContactAction);
  const state = form.state;
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && !values.id) ref.current?.reset();
  }, [state, values.id]);
  const fe = state.fieldErrors ?? {};
  return (
    <Form ref={ref} form={form} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />
      {values.id && <input type="hidden" name="contactId" value={values.id} />}
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" htmlFor="c-name" required error={fe.name}>
          <Input id="c-name" name="name" defaultValue={values.name ?? ""} required />
        </Field>
        <Field label="Job title" htmlFor="c-title" error={fe.title}>
          <Input id="c-title" name="title" defaultValue={values.title ?? ""} />
        </Field>
        <Field label="Phone" htmlFor="c-phone" error={fe.phone}>
          <Input id="c-phone" name="phone" defaultValue={values.phone ?? ""} />
        </Field>
        <Field label="Email" htmlFor="c-email" error={fe.email}>
          <Input id="c-email" name="email" type="email" defaultValue={values.email ?? ""} />
        </Field>
        <Field label="Notes" htmlFor="c-notes" className="md:col-span-2">
          <Textarea id="c-notes" name="notes" defaultValue={values.notes ?? ""} className="min-h-[60px]" />
        </Field>
      </div>
      <Checkbox name="isDecisionMaker" label="Decision maker" defaultChecked={values.isDecisionMaker ?? false} />
      <div className="flex gap-2">
        <SubmitButton>{values.id ? "Save contact" : "Add contact"}</SubmitButton>
        {cancelHref && (
          <Link href={cancelHref} className={buttonClass("outline")}>
            Cancel
          </Link>
        )}
      </div>
    </Form>
  );
}
