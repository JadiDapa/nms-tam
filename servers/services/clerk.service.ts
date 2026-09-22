import { clerkClient } from "@clerk/nextjs/server";
import { config } from "@/lib/config";

export const ClerkService = {
  // Sends the "you have been invited" email. The link opens /sign-up with a ticket, which is the only way to sign up.
  async invite(email: string) {
    const client = await clerkClient();
    await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${config.appUrl}/sign-up`,
      ignoreExisting: true,
      notify: true,
    });
  },

  // Deactivating a person also ends their Clerk sessions, so it takes effect immediately.
  async ban(clerkId: string) {
    const client = await clerkClient();
    await client.users.banUser(clerkId);
  },

  async unban(clerkId: string) {
    const client = await clerkClient();
    await client.users.unbanUser(clerkId);
  },
};
