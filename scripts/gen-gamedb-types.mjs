// Regenerate src/lib/gamedb-contract/gamedb-v1.d.ts from the pinned GameDB v1 schema
// (game-club #163). openapi-typescript needs TypeScript 5 as a peer, so it runs via npx
// in its own sandbox instead of being a project dependency. The schema's sha256 is
// stamped into the output so a test can tell when the types are stale.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";

const dir = "src/lib/gamedb-contract";
const spec = `${dir}/gamedb_v1.json`;
const out = `${dir}/gamedb-v1.d.ts`;
execFileSync(
  "npx",
  ["-y", "-p", "typescript@5", "-p", "openapi-typescript@7", "openapi-typescript", spec, "-o", out],
  { stdio: "inherit" },
);
const sha = createHash("sha256").update(fs.readFileSync(spec)).digest("hex");
fs.writeFileSync(out, `// gamedb_v1.json sha256: ${sha}\n` + fs.readFileSync(out, "utf8"));
console.log(`wrote ${out}`);
