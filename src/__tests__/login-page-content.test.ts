import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "..", "..");
const loginPagePath = path.join(repoRoot, "src", "app", "login", "page.tsx");
const forgotPasswordPagePath = path.join(repoRoot, "src", "app", "forgot-password", "page.tsx");

describe("sign-in recovery UI", () => {
  it("includes a forgot password link on the login page", () => {
    const loginPageSource = fs.readFileSync(loginPagePath, "utf8");

    expect(loginPageSource).toContain("Forgot password?");
    expect(loginPageSource).toContain('href="/forgot-password"');
    expect(loginPageSource).toContain('aria-label="Reset your password"');
  });

  it("includes a dedicated forgot password page", () => {
    const forgotPasswordSource = fs.readFileSync(forgotPasswordPagePath, "utf8");

    expect(forgotPasswordSource).toContain("Forgot your password?");
    expect(forgotPasswordSource).toContain('href="/login"');
  });
});
