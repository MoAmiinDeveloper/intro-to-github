import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StageRow } from "./stage-row";

export const metadata = { title: "Pipeline stages" };

export default async function StagesPage() {
  const stages = await prisma.pipelineStage.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader
        title="Pipeline stages"
        description="Each stage has a default win probability. Weighted value = value x probability. Exactly one Won stage (100%) and one Lost stage (0%) must be active."
      />
      <Card className="mb-5">
        <CardHeader title="Stages" description="Order, name, probability, type and meaning." />
        {stages.map((s) => (
          <StageRow key={s.id} stage={s} />
        ))}
      </Card>
      <Card>
        <CardHeader title="Add a stage" />
        <StageRow />
      </Card>
    </>
  );
}
