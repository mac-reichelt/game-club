import { describe, it, expect, vi, afterEach } from "vitest";
import { isSignupAvailable } from "@/lib/signupAvailability";

describe("isSignupAvailable", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true when SIGNUP_INVITE_CODE is configured", () => {
    vi.stubEnv("SIGNUP_INVITE_CODE", "club-invite");
    expect(isSignupAvailable()).toBe(true);
  });

  it("returns false when SIGNUP_INVITE_CODE is blank or unset", () => {
    vi.stubEnv("SIGNUP_INVITE_CODE", "   ");
    expect(isSignupAvailable()).toBe(false);

    vi.stubEnv("SIGNUP_INVITE_CODE", "");
    expect(isSignupAvailable()).toBe(false);
  });
});
