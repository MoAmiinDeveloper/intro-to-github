"use client";

import { useEffect, useRef } from "react";
import { saveListItemAction } from "./actions";
import { Checkbox, Input } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";

type Row = { id: string; name: string; active: boolean; sortOrder: number; email?: string | null };

export function ListRow({ kind, row, hasEmail }: { kind: string; row: Row; hasEmail: boolean }) {
  const form = useActionForm(saveListItemAction);
  const state = form.state;
  return (
    <Form form={form} className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3 last:border-0">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={row.id} />
      <Input name="name" defaultValue={row.name} className="w-64" aria-label="Name" required />
      {hasEmail && <Input name="email" defaultValue={row.email ?? ""} placeholder="Team email" className="w-64" aria-label="Email" />}
      <Input name="sortOrder" type="number" min={0} defaultValue={row.sortOrder} className="w-20" aria-label="Sort order" title="Sort order" />
      <Checkbox name="active" label="Active" defaultChecked={row.active} />
      <SubmitButton variant="outline" size="sm">
        Save
      </SubmitButton>
      <FormMessage state={state} className="py-1" />
    </Form>
  );
}

export function AddListItem({ kind, hasEmail, singular }: { kind: string; hasEmail: boolean; singular: string }) {
  const form = useActionForm(saveListItemAction);
  const state = form.state;
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <Form ref={ref} form={form} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      <div className="flex flex-wrap items-center gap-3">
        <Input name="name" placeholder={`New ${singular} name`} className="w-64" required />
        {hasEmail && <Input name="email" placeholder="Team email (optional)" className="w-64" />}
        <Input name="sortOrder" type="number" min={0} defaultValue={0} className="w-20" title="Sort order" />
        <SubmitButton size="md">Add</SubmitButton>
      </div>
      <FormMessage state={state} />
    </Form>
  );
}
