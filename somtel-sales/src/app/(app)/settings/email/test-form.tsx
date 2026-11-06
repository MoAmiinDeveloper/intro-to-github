"use client";

import { sendTestEmailAction } from "./actions";
import { Input } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";

export function TestEmailForm({ defaultTo, disabled }: { defaultTo: string; disabled: boolean }) {
  const form = useActionForm(sendTestEmailAction);
  const state = form.state;
  return (
    <Form form={form} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input name="to" type="email" defaultValue={defaultTo} className="w-72" required />
        <SubmitButton variant="navy" disabled={disabled} pendingText="Sending...">
          Send test email
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </Form>
  );
}
