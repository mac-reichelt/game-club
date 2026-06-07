import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetPassword = vi.fn();
const mockRunUpdate = vi.fn();

const mockPrepare = vi.fn((sql: string) => {
  if (sql.includes("SELECT password_hash")) {
    return { get: mockGetPassword };
  }
  if (sql.includes("UPDATE members")) {
    return { run: mockRunUpdate };
  }
  return { get: vi.fn(), run: vi.fn() };
});

vi.mock("@/lib/db", () => ({
  default: vi.fn().mockReturnValue({ prepare: mockPrepare }),
}));

vi.mock("@/lib/auth", () => ({
  getUserFromToken: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  invalidateAllSessions: vi.fn(),
  createSession: vi.fn(),
}));

function makeDeleteRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/profile", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Cookie: "session_token=test-token",
    },
    body: JSON.stringify(body),
  });
}

describe("DELETE /api/auth/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPassword.mockReturnValue({ password_hash: "stored-hash" });
  });

  it("requires authentication", async () => {
    const auth = await import("@/lib/auth");
    vi.mocked(auth.getUserFromToken).mockReturnValue(null);

    const { DELETE } = await import("@/app/api/auth/profile/route");
    const res = await DELETE(makeDeleteRequest({ currentPassword: "pw" }));

    expect(res.status).toBe(401);
  });

  it("requires current password", async () => {
    const auth = await import("@/lib/auth");
    vi.mocked(auth.getUserFromToken).mockReturnValue({
      id: 7,
      name: "Alice",
      avatar: "🎮",
      joined_at: "2024-01-01",
    });

    const { DELETE } = await import("@/app/api/auth/profile/route");
    const res = await DELETE(makeDeleteRequest({}));

    expect(res.status).toBe(400);
  });

  it("deactivates and anonymizes the account, then clears session cookie", async () => {
    const auth = await import("@/lib/auth");
    vi.mocked(auth.getUserFromToken).mockReturnValue({
      id: 7,
      name: "Alice",
      avatar: "🎮",
      joined_at: "2024-01-01",
    });
    vi.mocked(auth.verifyPassword).mockResolvedValue(true);

    const { DELETE } = await import("@/app/api/auth/profile/route");
    const res = await DELETE(makeDeleteRequest({ currentPassword: "correct-pass" }));

    expect(res.status).toBe(200);
    expect(mockRunUpdate).toHaveBeenCalledWith(
      "Deleted User #7",
      expect.any(String),
      7
    );
    expect(auth.invalidateAllSessions).toHaveBeenCalledWith(7);
    expect(res.headers.get("set-cookie")).toMatch(/session_token=/);
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
  });
});
