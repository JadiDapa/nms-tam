import AuthShell from "@/components/auth/AuthShell";
import SignOutButton from "@/components/auth/SignOutButton";

type Props = {
  searchParams: Promise<{ reason?: string }>;
};

// Reached when someone has a valid login but no account here (never invited) or the account was deactivated.
export default async function NotInvitedPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  const disabled = reason === "disabled";

  return (
    <AuthShell
      title={disabled ? "Account deactivated" : "No access yet"}
      description={
        disabled
          ? "Your account was deactivated. Please contact your administrator."
          : "This email address has not been invited. Ask your administrator to invite you, then sign in again."
      }
    >
      <div className="flex justify-center">
        <SignOutButton />
      </div>
    </AuthShell>
  );
}
