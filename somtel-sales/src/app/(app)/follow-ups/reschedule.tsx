"use client";

import { setFollowUpAction } from "../deals/actions";
import { Input } from "@/components/ui/input";
import { Form, SubmitButton, useActionForm } from "@/components/ui/form";

export function Reschedule({ dealId, current }: { dealId: string; current: string }) {
  const form = useActionForm(setFollowUpAction);
  return (
    <Form form={form} className="flex items-center gap-1">
      <input type="hidden" name="dealId" value={dealId} />
      <Input type="date" name="nextFollowUpAt" defaultValue={current} className="h-8 w-36" aria-label="Follow-up date" />
      <SubmitButton size="sm" variant="outline" pendingText="...">
        Move
      </SubmitButton>
      {form.state.error && <span className="text-xs text-red-600">{form.state.error}</span>}
    </Form>
  );
}
