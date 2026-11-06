"use client";

import { useEffect, useRef } from "react";
import { saveClauseAction } from "../terms/actions";
import { CLAUSE_CATEGORY_LABELS } from "../terms/labels";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";

type Clause = { id: string; category: string; text: string; sortOrder: number; active: boolean };

export function ClauseRow({ clause, children }: { clause?: Clause; children?: React.ReactNode }) {
  const form = useActionForm(saveClauseAction);
  const state = form.state;
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && !clause) ref.current?.reset();
  }, [state, clause]);
  return (
    <div className="flex flex-wrap items-start gap-3 border-b border-gray-100 px-5 py-3 last:border-0">
      <Form ref={ref} form={form} className="flex flex-1 flex-wrap items-center gap-3">
        {clause && <input type="hidden" name="id" value={clause.id} />}
        <Select name="category" defaultValue={clause?.category ?? "PAYMENT"} className="w-32" aria-label="Category">
          {Object.entries(CLAUSE_CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Input name="text" defaultValue={clause?.text ?? ""} placeholder="Clause text" className="min-w-[260px] flex-1" required aria-label="Text" />
        <Input name="sortOrder" type="number" min={0} defaultValue={clause?.sortOrder ?? 0} className="w-16" title="Order" aria-label="Order" />
        {clause && <Checkbox name="active" label="Active" defaultChecked={clause.active} />}
        <SubmitButton variant={clause ? "outline" : "primary"} size="sm">
          {clause ? "Save" : "Add clause"}
        </SubmitButton>
        <FormMessage state={state} className="w-full py-1" />
      </Form>
      {children}
    </div>
  );
}
