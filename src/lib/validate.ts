import { NextRequest, NextResponse } from "next/server";

/** Parse the request body as a JSON object; null if malformed or not an object. */
export async function readJsonObject(
  request: NextRequest
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  return null;
}

/** Parse a route id segment as a positive safe integer; null otherwise. */
export function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** undefined if absent, the string if valid, or null if the wrong type or too long. */
export function optionalString(
  value: unknown,
  maxLength: number
): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > maxLength) return null;
  return value;
}

export function badRequest(error = "Invalid request body") {
  return NextResponse.json({ error }, { status: 400 });
}
