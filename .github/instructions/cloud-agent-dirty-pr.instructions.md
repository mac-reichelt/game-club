---
applyTo: '**'
description: 'Manual rescue playbook for cloud Copilot agent PRs that go DIRTY (merge conflicts) when sibling PRs merge first. Apply when gh pr view N --json mergeStateStatus returns DIRTY and the agent has failed to self-rebase.'
---

# Cloud Copilot agent — DIRTY PR rescue playbook

When the Copilot coding agent (cloud, `copilot-swe-agent`) has multiple PRs
in flight and one lands, siblings go `mergeable_state: DIRTY` with conflicts.
The agent **can** rebase itself if pinged, but often rebases against **stale
main** and stays DIRTY. Faster to do it yourself via worktrees.

## Symptoms

- `gh pr view N --json mergeStateStatus` → `DIRTY`
- Commenting "please rebase" → agent pushes a merge commit against stale main
- Still DIRTY after its attempt

## Manual rescue (per PR)

```bash
# 1. Worktree per branch (one worktree dir per branch keeps WIP isolated)
BR=copilot/feat-whatever
git -C ~/repos/game-club worktree add ~/repos/.worktrees/game-club/$BR $BR
cd ~/repos/.worktrees/game-club/$BR

# 2. Reset and merge fresh main
git fetch origin --quiet
git reset --hard origin/$BR --quiet
git merge origin/main --no-edit

# 3. Resolve conflicts. Typical pattern in this Next.js repo:
#    - package.json: keep BOTH dependency additions
#    - package-lock.json: checkout --ours then regenerate (see below)
#    - src/lib/db.ts: keep both schema additions
#    - src/lib/types.ts: keep both interface additions

# 4. Regenerate package-lock.json + verify
git checkout --ours package-lock.json
npm install --package-lock-only
npm run build   # verify it still compiles

# 5. Run tests
npm test

# 6. Stage, commit
git add -A
GIT_EDITOR=true git commit --no-edit    # accept auto-generated merge msg

# 7. Push (plain push since we merged, not rebased)
git push origin HEAD:$BR

# 8. Rerun action_required workflows (Copilot bot push gate)
for id in $(gh run list --branch $BR --limit 20 \
  --json databaseId,conclusion \
  -q '.[] | select(.conclusion=="action_required") | .databaseId'); do
  gh run rerun $id
done

# 9. Re-arm auto-merge (push clears it)
gh pr merge $N --auto --squash
```

## Why rebase fails and merge succeeds

When the branch tip contains its own merge-from-main commit (`Merge branch
'main' into ...`), a linear `git rebase origin/main` tries to replay commits
that are already upstreamed → apply fails → "dropping ... patch contents
already upstream" → **but the unique branch changes get lost too**.

Merge preserves the branch's state and only needs you to resolve the delta
against today's main. Force-push not needed.

## Common conflict patterns in this repo

### `package.json` — dependency additions

Both PRs add different deps. Keep both:

```json
// <<<<<<< HEAD
"new-dep-a": "^1.0.0",
// =======
"new-dep-b": "^2.0.0",
// >>>>>>> main
```

Becomes:
```json
"new-dep-a": "^1.0.0",
"new-dep-b": "^2.0.0",
```

Then regenerate: `npm install --package-lock-only`

### `src/lib/db.ts` — schema additions

Both PRs add different tables. Keep both:

```typescript
// <<<<<<< HEAD
db.exec(`CREATE TABLE IF NOT EXISTS table_a (...)`);
// =======
db.exec(`CREATE TABLE IF NOT EXISTS table_b (...)`);
// >>>>>>> main
```

Becomes:
```typescript
db.exec(`CREATE TABLE IF NOT EXISTS table_a (...)`);
db.exec(`CREATE TABLE IF NOT EXISTS table_b (...)`);
```

### `src/lib/types.ts` — interface additions

Both PRs export different interfaces. Keep both.

## Resolving blocking review threads

`required_conversation_resolution: true` + Copilot's self-review threads =
BLOCKED even with all-green checks. Outdated threads don't auto-resolve.

```bash
# Find unresolved
gh api graphql -f query='{repository(owner:"mac-reichelt",name:"game-club"){
  pullRequest(number:N){reviewThreads(first:50){
    nodes{id isResolved isOutdated path}}}}}' \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved==false) | .id'

# Resolve each
for id in $(...); do
  gh api graphql -f query="mutation{resolveReviewThread(input:{threadId:\"$id\"}){thread{isResolved}}}"
done
```

## Additive merge script (use with care)

For purely additive conflicts (e.g. two PRs each add routes to the same file),
this Python one-liner resolves all conflict markers by concatenating both sides:

```python
import re, sys
p = sys.argv[1]
s = open(p).read()
s = re.sub(
    r'<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>> [^\n]+\n',
    lambda m: m.group(1) + m.group(2),
    s, flags=re.DOTALL)
open(p, 'w').write(s)
```

**Mandatory post-checks** (the script silently produces broken code otherwise):

```bash
# TypeScript syntax check
npx tsc --noEmit

# Check for duplicate exports
grep -nE '^export (const|function|class|interface|type) [A-Za-z]+' src/lib/types.ts | \
  awk '{print $3}' | sort | uniq -d

# Run tests
npm test
```

TypeScript silently accepts duplicate `export const` — the **last** definition
wins, shadowing earlier ones. Always run `tsc --noEmit` after additive merges.
