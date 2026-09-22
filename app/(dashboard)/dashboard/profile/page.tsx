import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import ProfilePanel from "@/components/dashboard/profile/ProfilePanel";

export default async function ProfilePage() {
  await requireUser();

  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="Profile & Security"
        subtitle="Your password, two-step verification (authenticator app and backup codes) and active sessions."
      />
      <ProfilePanel />
    </main>
  );
}
