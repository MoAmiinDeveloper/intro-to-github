"use client";

import { useEffect, useRef } from "react";
import { saveStageAction } from "./actions";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";

type Stage = { id?: string; name: string; description: string | null; probability: number; kind: string; sortOrder: number; active: boolean };

export function StageRow({ stage }: { stage?: Stage }) {
  const form = useActionForm(saveStageAction);
  const state = form.state;
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && !stage) ref.current?.reset();
  }, [state, stage]);
  const fe = state.fieldErrors ?? {};
  return (
    <Form ref={ref} form={form} className="space-y-2 border-b border-gray-100 px-5 py-3 last:border-0">
      {stage?.id && <input type="hidden" name="id" value={stage.id} />}
      <div className="flex flex-wrap items-center gap-3">
        <Input name="sortOrder" type="number" min={0} defaultValue={stage?.sortOrder ?? 0} className="w-16" title="Order" aria-label="Order" />
        <Input name="name" defaultValue={stage?.name ?? ""} placeholder="Stage name" className="w-44" required aria-label="Name" />
        <div className="flex items-center gap-1">
          <Input name="probability" type="number" min={0} max={100} defaultValue={stage?.probability ?? 0} className="w-20" aria-label="Probability" />
          <span className="text-sm text-gray-500">%</span>
        </div>
        <Select name="kind" defaultValue={stage?.kind ?? "OPEN"} className="w-28" aria-label="Kind">
          <option value="OPEN">Open</option>
          <option value="WON">Won</option>
          <option value="LOST">Lost</option>
        </Select>
        <Input name="description" defaultValue={stage?.description ?? ""} placeholder="Meaning" className="min-w-[200px] flex-1" aria-label="Meaning" />
        {stage && <Checkbox name="active" label="Active" defaultChecked={stage.active} />}
        <SubmitButton variant={stage ? "outline" : "primary"} size="sm">
          {stage ? "Save" : "Add stage"}
        </SubmitButton>
      </div>
      {(fe.probability || fe.name) && <p className="text-xs text-red-600">{fe.probability ?? fe.name}</p>}
      <FormMessage state={state} className="py-1" />
    </Form>
  );
}
