import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { hashPassword, verifyPassword, needsRehash } from "@/lib/auth";

// ---------------------------------------------------------------------------
// hashPassword (scrypt)
// ---------------------------------------------------------------------------

describe("hashPassword", () => {
  it("returns a scrypt:<salt>:<hash> formatted string", async () => {
    const result = await hashPassword("mypassword");
    const parts = result.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("scrypt");
    expect(parts[1]).toHaveLength(32); // 16 bytes hex = 32 chars
    expect(parts[2]).toHaveLength(128); // 64 bytes hex = 128 chars
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const hash1 = await hashPassword("samepassword");
    const hash2 = await hashPassword("samepassword");
    expect(hash1).not.toBe(hash2);
  });

  it("produces different hashes for different passwords", async () => {
    const hash1 = await hashPassword("password1");
    const hash2 = await hashPassword("password2");
    expect(hash1.split(":")[2]).not.toBe(hash2.split(":")[2]);
  });
});

// ---------------------------------------------------------------------------
// needsRehash
// ---------------------------------------------------------------------------

describe("needsRehash", () => {
  it("returns false for a scrypt hash", async () => {
    const hash = await hashPassword("anypassword");
    expect(needsRehash(hash)).toBe(false);
  });

  it("returns true for a legacy SHA-256 hash", () => {
    // Simulate a legacy hash produced by the old implementation
    const salt = crypto.randomBytes(16).toString("hex");
    const hashHex = crypto
      .createHash("sha256")
      .update(salt + "password")
      .digest("hex");
    const legacyHash = `${salt}:${hashHex}`;
    expect(needsRehash(legacyHash)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// verifyPassword — scrypt (new format)
// ---------------------------------------------------------------------------

describe("verifyPassword (scrypt)", () => {
  it("returns true for correct password", async () => {
    const stored = await hashPassword("correcthorse");
    expect(await verifyPassword("correcthorse", stored)).toBe(true);
  });

  it("returns false for incorrect password", async () => {
    const stored = await hashPassword("correcthorse");
    expect(await verifyPassword("wrongpassword", stored)).toBe(false);
  });

  it("returns false for empty password against non-empty stored hash", async () => {
    const stored = await hashPassword("notempty");
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("handles hashing and verifying empty password", async () => {
    const stored = await hashPassword("");
    expect(await verifyPassword("", stored)).toBe(true);
    expect(await verifyPassword("notempty", stored)).toBe(false);
  });

  it("handles special characters in passwords", async () => {
    const specials = "p@$$w0rd!#%^&*()_+-=[]{}|;':\",./<>?`~";
    const stored = await hashPassword(specials);
    expect(await verifyPassword(specials, stored)).toBe(true);
  });

  it("handles unicode characters", async () => {
    const unicode = "密码🔑пароль";
    const stored = await hashPassword(unicode);
    expect(await verifyPassword(unicode, stored)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// verifyPassword — legacy SHA-256 format (migration path)
// ---------------------------------------------------------------------------

describe("verifyPassword (legacy SHA-256)", () => {
  function legacyHash(password: string): string {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto
      .createHash("sha256")
      .update(salt + password)
      .digest("hex");
    return `${salt}:${hash}`;
  }

  it("verifies correct password against a legacy hash", async () => {
    const stored = legacyHash("oldpassword");
    expect(await verifyPassword("oldpassword", stored)).toBe(true);
  });

  it("rejects wrong password against a legacy hash", async () => {
    const stored = legacyHash("oldpassword");
    expect(await verifyPassword("notthepassword", stored)).toBe(false);
  });

  it("returns false for malformed stored hash", async () => {
    expect(await verifyPassword("anything", "nocolon")).toBe(false);
    expect(await verifyPassword("anything", "scrypt:only:two")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DUMMY_SCRYPT_HASH (used by login route for timing-safe missing-account path)
// ---------------------------------------------------------------------------

import { DUMMY_SCRYPT_HASH } from "@/lib/auth";

describe("DUMMY_SCRYPT_HASH", () => {
  it("is in scrypt:<salt>:<hash> format (3 colon-separated parts)", () => {
    const parts = DUMMY_SCRYPT_HASH.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("scrypt");
    expect(parts[1]).toHaveLength(32);
    expect(parts[2]).toHaveLength(128);
  });

  it("verifyPassword returns false for any password against the dummy hash", async () => {
    expect(await verifyPassword("anypassword", DUMMY_SCRYPT_HASH)).toBe(false);
    expect(await verifyPassword("", DUMMY_SCRYPT_HASH)).toBe(false);
  });
});
