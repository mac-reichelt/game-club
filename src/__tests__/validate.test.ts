import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { readJsonObject, parseId, optionalString } from "@/lib/validate";

function req(body: string) {
  return new NextRequest("http://x/api", { method: "POST", body });
}

describe("validate helpers", () => {
  it("readJsonObject rejects malformed and non-object bodies", async () => {
    expect(await readJsonObject(req("{bad"))).toBeNull();
    expect(await readJsonObject(req("[1,2]"))).toBeNull();
    expect(await readJsonObject(req("null"))).toBeNull();
    expect(await readJsonObject(req('{"a":1}'))).toEqual({ a: 1 });
  });
  it("parseId only accepts positive integers", () => {
    expect(parseId("12")).toBe(12);
    for (const bad of ["0", "-1", "1.5", "abc", "", "1e3", "99999999999999999999"]) {
      expect(parseId(bad)).toBeNull();
    }
  });
  it("optionalString enforces type and length", () => {
    expect(optionalString(undefined, 5)).toBeUndefined();
    expect(optionalString("abc", 5)).toBe("abc");
    expect(optionalString("abcdef", 5)).toBeNull();
    expect(optionalString(42, 5)).toBeNull();
  });
});
