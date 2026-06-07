import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGet = vi.fn();
const mockRun = vi.fn();
const mockPrepare = vi.fn().mockReturnValue({ get: mockGet, run: mockRun });

vi.mock("@/lib/db", () => ({
  default: vi.fn().mockReturnValue({ prepare: mockPrepare }),
}));

vi.mock("@/lib/auth", () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  needsRehash: vi.fn().mockReturnValue(false),
  createSession: vi.fn().mockReturnValue("session-token"),
  isAccountLocked: vi.fn().mockReturnValue(false),
  isIpThrottled: vi.fn().mockReturnValue(false),
  checkAndRecordAttempt: vi.fn(),
  recordIpAttempt: vi.fn(),
  resetLoginAttempts: vi.fn(),
  cleanupOldLoginAttempts: vi.fn(),
  DUMMY_SCRYPT_HASH: `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`,
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login deactivated accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrepare.mockReturnValue({ get: mockGet, run: mockRun });
  });

  it("returns a clear error when credentials are valid but account is deactivated", async () => {
    mockGet.mockReturnValue({
      id: 1,
      name: "Alice",
      password_hash: "stored-hash",
      disabled: 0,
      active: 0,
    });
    const auth = await import("@/lib/auth");
    vi.mocked(auth.verifyPassword).mockResolvedValue(true);

    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ name: "Alice", password: "correct-pass" }));

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/deactivated/i);
    expect(auth.createSession).not.toHaveBeenCalled();
  });
});
