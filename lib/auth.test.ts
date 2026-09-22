import { beforeEach, describe, expect, it, vi } from "vitest";

// The guards are what stops one client reaching another's data, so they are tested against every kind of visitor.
const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => authMock(), currentUser: async () => null }));
vi.mock("react", () => ({ cache: <T,>(fn: T) => fn }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const getByClerkId = vi.fn();
vi.mock("@/servers/services/user.service", () => ({
  UserService: { getByClerkId: (id: string) => getByClerkId(id), linkClerk: async () => null },
}));

import { assertAdmin, assertClient, assertUser, requireAdmin, requireClient, requireUser } from "./auth";

const user = (over: Record<string, unknown> = {}) => ({ id: 1, clerkId: "c1", email: "a@b.c", role: "USER", orgId: 7, active: true, ...over });

beforeEach(() => {
  authMock.mockReset();
  getByClerkId.mockReset();
});

const signedInAs = (u: ReturnType<typeof user> | null) => {
  authMock.mockResolvedValue({ userId: u ? "c1" : null });
  getByClerkId.mockResolvedValue(u);
};

describe("server action guards (they throw, never redirect)", () => {
  it("refuse a visitor who is not signed in", async () => {
    signedInAs(null);
    await expect(assertUser()).rejects.toMatchObject({ status: 401 });
  });

  it("refuse someone signed in to Clerk but never invited", async () => {
    authMock.mockResolvedValue({ userId: "c9" });
    getByClerkId.mockResolvedValue(null);
    await expect(assertUser()).rejects.toMatchObject({ status: 403 });
  });

  it("refuse a deactivated user", async () => {
    signedInAs(user({ active: false }));
    await expect(assertUser()).rejects.toMatchObject({ status: 403 });
  });

  it("assertAdmin lets an admin in and refuses a client user", async () => {
    signedInAs(user({ role: "ADMIN", orgId: null }));
    await expect(assertAdmin()).resolves.toMatchObject({ role: "ADMIN" });
    signedInAs(user());
    await expect(assertAdmin()).rejects.toMatchObject({ status: 403 });
  });

  it("assertClient returns the user's OWN organization and refuses admins and org-less users", async () => {
    signedInAs(user({ orgId: 7 }));
    await expect(assertClient()).resolves.toMatchObject({ orgId: 7 });
    signedInAs(user({ role: "ADMIN", orgId: null }));
    await expect(assertClient()).rejects.toMatchObject({ status: 403 });
    signedInAs(user({ role: "USER", orgId: null }));
    await expect(assertClient()).rejects.toMatchObject({ status: 403 });
  });
});

describe("page guards (they redirect)", () => {
  it("send visitors to the right place", async () => {
    signedInAs(null);
    await expect(requireUser()).rejects.toThrow("REDIRECT:/sign-in");

    authMock.mockResolvedValue({ userId: "c9" });
    getByClerkId.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("REDIRECT:/not-invited");

    signedInAs(user({ active: false }));
    await expect(requireUser()).rejects.toThrow("REDIRECT:/not-invited?reason=disabled");
  });

  it("keep clients out of admin pages and admins out of client pages", async () => {
    signedInAs(user());
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/dashboard");
    await expect(requireClient()).resolves.toMatchObject({ orgId: 7 });

    signedInAs(user({ role: "ADMIN", orgId: null }));
    await expect(requireAdmin()).resolves.toBeTruthy();
    await expect(requireClient()).rejects.toThrow("REDIRECT:/dashboard");
  });
});
