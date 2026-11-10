import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// game-club #161: legacy SHA-256 hashes are upgraded to scrypt only after a
// successful login; failed logins never touch the stored hash.

const mockGet = vi.fn();
const mockRun = vi.fn();
const mockPrepare = vi.fn();

vi.mock("@/lib/db", () => ({
  default: vi.fn().mockReturnValue({ prepare: (sql: string) => mockPrepare(sql) }),
}));

vi.mock("@/lib/auth", () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn().mockResolvedValue("scrypt:new"),
  needsRehash: vi.fn((h: string) => !h.startsWith("scrypt:")),
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

function login(password: string) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Alice", password }),
  });
}

const legacy = { id: 7, name: "Alice", password_hash: "salt:abcd", disabled: 0, active: 1 };
const rehashCalls = () =>
  mockPrepare.mock.calls.filter(([sql]) => /UPDATE members SET password_hash/.test(sql)).length;

describe("POST /api/auth/login legacy hash upgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrepare.mockReturnValue({ get: mockGet, run: mockRun });
    mockGet.mockReturnValue(legacy);
  });

  it("rehashes a legacy hash to scrypt on successful login", async () => {
    const auth = await import("@/lib/auth");
    vi.mocked(auth.verifyPassword).mockResolvedValue(true);
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(login("right"));
    expect(res.status).toBe(200);
    expect(rehashCalls()).toBe(1);
    expect(mockRun).toHaveBeenCalledWith("scrypt:new", 7);
  });

  it("leaves the hash alone when the password is wrong", async () => {
    const auth = await import("@/lib/auth");
    vi.mocked(auth.verifyPassword).mockResolvedValue(false);
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(login("wrong"));
    expect(res.status).toBe(401);
    expect(rehashCalls()).toBe(0);
    expect(auth.hashPassword).not.toHaveBeenCalled();
  });

  it("does not rehash an already-scrypt hash", async () => {
    mockGet.mockReturnValue({ ...legacy, password_hash: "scrypt:a:b" });
    const auth = await import("@/lib/auth");
    vi.mocked(auth.verifyPassword).mockResolvedValue(true);
    const { POST } = await import("@/app/api/auth/login/route");
    expect((await POST(login("right"))).status).toBe(200);
    expect(rehashCalls()).toBe(0);
  });
});
