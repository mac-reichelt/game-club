import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the database module before importing the route
vi.mock("@/lib/db", () => {
  const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 42 });
  const mockGet = vi.fn().mockReturnValue(null); // no existing user
  const mockPrepare = vi.fn().mockReturnValue({ get: mockGet, run: mockRun });
  return { default: vi.fn().mockReturnValue({ prepare: mockPrepare }) };
});

// Mock auth helpers
vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn().mockReturnValue("salt:hashedpassword"),
  createSession: vi.fn().mockReturnValue("mock-session-token"),
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/signup — invite code gate", () => {
  const VALID_CODE = "super-secret-club-code";

  beforeEach(() => {
    vi.stubEnv("SIGNUP_INVITE_CODE", VALID_CODE);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 403 when invite code is missing", async () => {
    // Lazy import so env stub is applied first
    const { POST } = await import("@/app/api/auth/signup/route");
    const req = makeRequest({ name: "Alice", password: "password123" });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/invite code/i);
  });

  it("returns 403 when invite code is wrong", async () => {
    const { POST } = await import("@/app/api/auth/signup/route");
    const req = makeRequest({
      name: "Alice",
      password: "password123",
      inviteCode: "wrong-code",
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/invite code/i);
  });

  it("returns 201 when invite code is correct", async () => {
    const { POST } = await import("@/app/api/auth/signup/route");
    const req = makeRequest({
      name: "Alice",
      password: "password123",
      inviteCode: VALID_CODE,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("returns 403 when SIGNUP_INVITE_CODE env var is not configured", async () => {
    vi.stubEnv("SIGNUP_INVITE_CODE", "");
    vi.resetModules();
    const { POST } = await import("@/app/api/auth/signup/route");
    const req = makeRequest({
      name: "Alice",
      password: "password123",
      inviteCode: VALID_CODE,
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/not available/i);
  });
});
