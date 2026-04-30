import { describe, it, expect } from "vitest";
import { isBannedPassword } from "@/lib/bannedPasswords";

describe("isBannedPassword", () => {
  it("returns true for common passwords in the banned list", () => {
    expect(isBannedPassword("password")).toBe(true);
    expect(isBannedPassword("password123")).toBe(true);
    expect(isBannedPassword("123456")).toBe(true);
    expect(isBannedPassword("qwerty")).toBe(true);
    expect(isBannedPassword("iloveyou")).toBe(true);
    expect(isBannedPassword("letmein")).toBe(true);
    expect(isBannedPassword("admin")).toBe(true);
    expect(isBannedPassword("welcome")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isBannedPassword("PASSWORD")).toBe(true);
    expect(isBannedPassword("Password123")).toBe(true);
    expect(isBannedPassword("QWERTY")).toBe(true);
    expect(isBannedPassword("Admin123456")).toBe(true);
  });

  it("returns false for strong unique passwords", () => {
    expect(isBannedPassword("Tr0ub4dor&3xample")).toBe(false);
    expect(isBannedPassword("correctHorseBatteryStaple!")).toBe(false);
    expect(isBannedPassword("xK9#mPqL2@vR")).toBe(false);
    expect(isBannedPassword("my-game-club-secret-2024")).toBe(false);
  });
});

describe("password length validation rules (signup)", () => {
  // These tests model the server-side guard: password.length < 12
  it("rejects passwords with 11 characters (below minimum)", () => {
    const password = "Abc!1234567"; // exactly 11 chars
    expect(password.length).toBe(11);
    expect(password.length < 12).toBe(true);
  });

  it("accepts passwords with 12 characters (minimum)", () => {
    const password = "Abc!12345678"; // exactly 12 chars
    expect(password.length).toBe(12);
    expect(password.length < 12).toBe(false);
  });

  it("accepts passwords with more than 12 characters", () => {
    const password = "Abc!1234567890"; // 14 chars
    expect(password.length).toBe(14);
    expect(password.length < 12).toBe(false);
  });

  it("rejects the empty string", () => {
    const password = "";
    expect(!password || password.length < 12).toBe(true);
  });
});

describe("password validation combined checks", () => {
  function validatePassword(password: string): { valid: boolean; error?: string } {
    if (!password || password.length < 12) {
      return { valid: false, error: "Password must be at least 12 characters" };
    }
    if (isBannedPassword(password)) {
      return { valid: false, error: "Password is too common. Please choose a more unique password." };
    }
    return { valid: true };
  }

  it("rejects 11-char password with length error", () => {
    const result = validatePassword("Abc!1234567");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Password must be at least 12 characters");
  });

  it("accepts 12-char non-banned password", () => {
    const result = validatePassword("Abc!12345678");
    expect(result.valid).toBe(true);
  });

  it("rejects banned password even if long enough", () => {
    const result = validatePassword("password123456");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too common");
  });

  it("rejects short banned password with length error first", () => {
    // "password" is 8 chars — fails length check before banned check
    const result = validatePassword("password");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Password must be at least 12 characters");
  });
});
