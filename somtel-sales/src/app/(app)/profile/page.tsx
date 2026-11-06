import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/roles";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PasswordForm, ProfileForm } from "./forms";

export const metadata = { title: "My profile" };

export default async function ProfilePage() {
  const me = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id }, include: { manager: { select: { name: true } } } });
  return (
    <>
      <PageHeader title="My profile" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Details" />
          <CardBody>
            <div className="mb-4 flex flex-wrap gap-1">
              {me.roles.map((r) => (
                <Badge key={r} tone="navy">
                  {ROLE_LABELS[r]}
                </Badge>
              ))}
            </div>
            {user.manager && <p className="mb-4 text-sm text-gray-600">Reports to {user.manager.name}</p>}
            <ProfileForm values={user} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Password" />
          <CardBody>
            <PasswordForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
