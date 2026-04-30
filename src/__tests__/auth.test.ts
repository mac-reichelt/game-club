import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, DUMMY_SCRYPT_HASH } from "@/lib/auth";

describe("hashPassword", () => {
  it("returns a salt:hash formatted string", () => {
    const result = hashPassword("mypassword");
    expect(result).toContain(":");
    const parts = result.split(":");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(32); // 16 bytes hex = 32 chars
    expect(parts[1]).toHaveLength(64); // sha256 hex = 64 chars
  });

  it("produces different hashes for the same password (random salt)", () => {
    const hash1 = hashPassword("samepassword");
    const hash2 = hashPassword("samepassword");
    expect(hash1).not.toBe(hash2);
  });

  it("produces different hashes for different passwords", () => {
    const hash1 = hashPassword("password1");
    const hash2 = hashPassword("password2");
    expect(hash1.split(":")[1]).not.toBe(hash2.split(":")[1]);
  });
});

describe("verifyPassword", () => {
  it("returns true for correct password", () => {
    const stored = hashPassword("correcthorse");
    expect(verifyPassword("correcthorse", stored)).toBe(true);
  });

  it("returns false for incorrect password", () => {
    const stored = hashPassword("correcthorse");
    expect(verifyPassword("wrongpassword", stored)).toBe(false);
  });

  it("returns false for empty password against stored hash", () => {
    const stored = hashPassword("notempty");
    expect(verifyPassword("", stored)).toBe(false);
  });

  it("handles hashing and verifying empty password", () => {
    const stored = hashPassword("");
    expect(verifyPassword("", stored)).toBe(true);
    expect(verifyPassword("notempty", stored)).toBe(false);
  });

  it("handles special characters in passwords", () => {
    const specials = "p@$$w0rd!#%^&*()_+-=[]{}|;':\",./<>?`~";
    const stored = hashPassword(specials);
    expect(verifyPassword(specials, stored)).toBe(true);
  });

  it("handles unicode characters", () => {
    const unicode = "密码🔑пароль";
    const stored = hashPassword(unicode);
    expect(verifyPassword(unicode, stored)).toBe(true);
  });
});

describe("DUMMY_SCRYPT_HASH", () => {
  it("is in scrypt:<salt>:<hash> format (3 colon-separated parts)", () => {
    const parts = DUMMY_SCRYPT_HASH.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("scrypt");
    expect(parts[1]).toHaveLength(32);  // 32-char hex salt placeholder
    expect(parts[2]).toHaveLength(128); // 128-char hex hash placeholder
  });

  it("verifyPassword returns false for any password against the dummy hash", () => {
    // The dummy is intentionally invalid so it always rejects — what matters
    // is that the code path reaches verifyPassword rather than skipping it.
    expect(verifyPassword("anypassword", DUMMY_SCRYPT_HASH)).toBe(false);
    expect(verifyPassword("", DUMMY_SCRYPT_HASH)).toBe(false);
  });

  // TODO (post-PR #45 scrypt): verify that verifyPassword('any', DUMMY_SCRYPT_HASH)
  // takes ≥ 50 ms once the scrypt KDF is active, confirming the full derivation
  // runs on unknown-account paths (timing-safe account-existence check).
});
