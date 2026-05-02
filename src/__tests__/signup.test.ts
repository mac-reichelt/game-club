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
  hashPassword: vi.fn().mockResolvedValue("salt:hashedpassword"),
  createSession: vi.fn().mockReturnValue("mock-session-token"),
  isIpThrottled: vi.fn().mockReturnValue(false),
  recordIpAttempt: vi.fn(),
  cleanupOldLoginAttempts: vi.fn(),
  getClientIp: vi.fn().mockReturnValue("1.2.3.4"),
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
    const req = makeRequest({ name: "Alice", password: "Sup3rUniqueT3st!" });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/invite code/i);
  });

  it("returns 403 when invite code is wrong", async () => {
    const { POST } = await import("@/app/api/auth/signup/route");
    const req = makeRequest({
      name: "Alice",
      password: "Sup3rUniqueT3st!",
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
      password: "Sup3rUniqueT3st!",
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
      password: "Sup3rUniqueT3st!",
      inviteCode: VALID_CODE,
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/not available/i);
  });
});

describe("POST /api/auth/signup — IP throttle", () => {
  const VALID_CODE = "super-secret-club-code";

  beforeEach(() => {
    vi.stubEnv("SIGNUP_INVITE_CODE", VALID_CODE);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 429 when the IP is throttled", async () => {
    const auth = await import("@/lib/auth");
    vi.mocked(auth.isIpThrottled).mockReturnValue(true);

    const { POST } = await import("@/app/api/auth/signup/route");
    const req = makeRequest({
      name: "Alice",
      password: "Sup3rUniqueT3st!",
      inviteCode: VALID_CODE,
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toMatch(/too many requests/i);
  });

  it("does not throttle when IP is under the limit", async () => {
    const auth = await import("@/lib/auth");
    vi.mocked(auth.isIpThrottled).mockReturnValue(false);

    const { POST } = await import("@/app/api/auth/signup/route");
    const req = makeRequest({
      name: "Alice",
      password: "Sup3rUniqueT3st!",
      inviteCode: VALID_CODE,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("records an IP attempt when name is already taken", async () => {
    const db = await import("@/lib/db");
    const auth = await import("@/lib/auth");
    vi.mocked(auth.isIpThrottled).mockReturnValue(false);

    // Simulate name already taken
    const mockGet = vi.fn().mockReturnValue({ id: 1 });
    const mockPrepare = vi.fn().mockReturnValue({ get: mockGet, run: vi.fn() });
    vi.mocked(db.default).mockReturnValue({ prepare: mockPrepare } as never);

    const { POST } = await import("@/app/api/auth/signup/route");
    const req = makeRequest({
      name: "Alice",
      password: "Sup3rUniqueT3st!",
      inviteCode: VALID_CODE,
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    expect(auth.recordIpAttempt).toHaveBeenCalled();
  });

  it("does not check throttle before validating invite code", async () => {
    const auth = await import("@/lib/auth");
    vi.mocked(auth.isIpThrottled).mockReturnValue(true);

    const { POST } = await import("@/app/api/auth/signup/route");
    // Wrong invite code — throttle should NOT be checked (no DB call)
    const req = makeRequest({
      name: "Alice",
      password: "Sup3rUniqueT3st!",
      inviteCode: "wrong-code",
    });
    const res = await POST(req);
    // Should get 403 (bad invite code), not 429 (throttled)
    expect(res.status).toBe(403);
    expect(auth.isIpThrottled).not.toHaveBeenCalled();
  });
});

