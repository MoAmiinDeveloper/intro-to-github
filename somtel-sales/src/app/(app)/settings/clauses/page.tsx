import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/form";
import { deleteClauseAction } from "../terms/actions";
import { ClauseRow } from "./clause-row";

export const metadata = { title: "T&C clauses" };

export default async function ClausesPage() {
  const clauses = await prisma.termsClause.findMany({ where: { deletedAt: null }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
  return (
    <>
      <PageHeader title="T&C clauses" description="Short clauses sales can add to a quote with one click, for example the payment term or the scope note." />
      <Card className="mb-5">
        <CardHeader title="Add a clause" />
        <ClauseRow />
      </Card>
      <Card>
        <CardHeader title="Saved clauses" />
        {clauses.length === 0 && <p className="px-5 py-4 text-sm text-gray-500">None yet.</p>}
        {clauses.map((c) => (
          <ClauseRow key={c.id} clause={c}>
            <form action={deleteClauseAction}>
              <input type="hidden" name="id" value={c.id} />
              <ConfirmSubmit variant="ghost" size="icon" message="Delete this clause?" pendingText="" title="Delete">
                <Trash2 className="h-4 w-4 text-red-600" />
              </ConfirmSubmit>
            </form>
          </ClauseRow>
        ))}
      </Card>
    </>
  );
}
