# Contributing

Thanks for your interest in Game Club. This is a small personal project that's
public for transparency, but day-to-day development happens inside this repo,
not via fork PRs.

## Reporting issues

Open a GitHub issue. Bugs, feature ideas, and security reports are all welcome.
For security-sensitive reports, see [SECURITY.md](./SECURITY.md).

## Code contributions

### Fork PRs are not supported end-to-end

The CI/review pipeline relies on workflows that require write access to this
repository's API:

- `agent-review`, `devops-review`, `security-review`, `tech-writer-review` all
  publish PR reviews and check-runs via `gh api`.
- Tech-writer additionally pushes doc-fix commits back to the PR branch.

GitHub policy gives fork-PR workflows a **read-only** `GITHUB_TOKEN` and no
access to repository secrets. As a result, a PR opened from a fork will sit in
a broken state: the four required `*-review` checks will fail with 403s, and
the PR will be unmergeable through the normal flow.

This is a deliberate trade-off (tracked under [issue #73](https://github.com/mac-reichelt/game-club/issues/73)). Mergeable fork PRs
would require running the review workflows under `pull_request_target`, which
introduces well-known security risks and significantly more code to manage
safely.

### Working around the limitation

If you want to contribute a code change:

1. **Open an issue first** describing the change. If we agree on the approach,
   I'll grant you a feature branch on this repo so the review pipeline runs
   end-to-end. Push to that branch and open the PR from inside the repo.
2. **Or**: open the fork PR anyway. I'll cherry-pick the commit(s) onto a
   branch in this repo, credit you in the merge commit, and the original fork
   PR will be closed.

## Local development

See the README for setup. The short version:

```bash
npm install
npm run dev   # http://localhost:3000
```

Run the test suite before pushing:

```bash
npm test
npm run lint
npm run build
```

## Commit conventions

[Conventional Commits](https://www.conventionalcommits.org/). Examples:

- `feat(nominations): add gamedb_id backfill job`
- `fix(auth): tighten signup throttle`
- `docs(security): note fork-PR limitation`

The `tech-writer-review` workflow auto-maintains user-facing docs, so a
"missing CHANGELOG entry" review note is normal — let it land its own commit.
