# Notes for Claude

## Git workflow

A scheduled job pushes "Daily data refresh" commits directly to `origin/master`,
so the local branch is frequently behind without warning. To avoid divergent
branches:

- Always `git pull --rebase` before committing (and again before pushing).
- Local repo config sets `pull.rebase = true`, so a plain `git pull` rebases too.
- Local work rebases cleanly on top of refresh commits in the normal case: the
  refresh touches `data/` and built `web/` assets, not `src/` or `tests/`.
