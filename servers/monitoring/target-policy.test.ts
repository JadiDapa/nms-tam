import { describe, expect, it } from "vitest";
import { assertTargetAllowed, isPrivateAddress } from "./target-policy";

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1", "127.5.5.5", "10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.255", "192.168.1.1",
    "169.254.169.254", "100.64.0.1", "100.127.255.254", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1",
    "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "::ffff:10.0.0.1", "::ffff:127.0.0.1",
  ])("%s is private/reserved", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "103.79.237.33", "172.15.0.1", "172.32.0.1", "100.63.0.1", "100.128.0.1", "192.169.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "%s is public",
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );

  it("treats anything that is not an IP as unsafe", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
  });
});

describe("assertTargetAllowed", () => {
  it("refuses literal private addresses and localhost", async () => {
    await expect(assertTargetAllowed("10.1.2.3")).rejects.toThrow(/private or reserved/);
    await expect(assertTargetAllowed("127.0.0.1")).rejects.toThrow(/private or reserved/);
    await expect(assertTargetAllowed("localhost")).rejects.toThrow(/private or reserved/);
  });

  it("accepts a public IP", async () => {
    await expect(assertTargetAllowed("8.8.8.8")).resolves.toBeUndefined();
  });

  it("refuses names that do not resolve", async () => {
    await expect(assertTargetAllowed("no-such-host.invalid")).rejects.toThrow(/cannot be resolved/);
  });
});
