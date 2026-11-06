import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { canEditClient, clientScope } from "@/lib/clients";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { ContactForm } from "../../../../contact-form";

export const metadata = { title: "Edit contact" };

export default async function EditContactPage({ params }: { params: Promise<{ id: string; contactId: string }> }) {
  const { id, contactId } = await params;
  const user = await requirePermission("clients.view");
  const client = await prisma.client.findFirst({ where: { AND: [{ id, deletedAt: null }, await clientScope(user)] } });
  if (!client || !(await canEditClient(user, client))) notFound();
  const contact = await prisma.contact.findFirst({ where: { id: contactId, clientId: id, deletedAt: null } });
  if (!contact) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Edit ${contact.name}`}
        breadcrumbs={[
          { label: "Clients", href: "/clients" },
          { label: client.name, href: `/clients/${id}?tab=contacts` },
          { label: "Edit contact" },
        ]}
      />
      <Card>
        <CardBody>
          <ContactForm clientId={id} values={contact} cancelHref={`/clients/${id}?tab=contacts`} />
        </CardBody>
      </Card>
    </div>
  );
}
