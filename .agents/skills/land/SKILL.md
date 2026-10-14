---
name: land
description: >-
  Land changes from the current thread to origin/main. Only invoke when the user
  has explicitly requested landing (Land Changes button, /land, or equivalent).
disable-model-invocation: true
metadata:
  delta-action: land
---

## Steps

1. **Stage and commit changes**
   - If the working tree has uncommitted changes, add them all and commit with a concise
     message summarising the change.
   - If the working tree is already clean, skip this step.

2. **Fetch and merge into main**
   - `git checkout main`
   - `git fetch origin main`
   - `git merge --no-ff <current-branch>` to integrate the changes into `main`.
   - **Conflicts:** resolve automatically when the intended result is clear (e.g. clean
     addition of unrelated files). On ambiguous or overlapping conflicts, pause and ask
     the user.

3. **Push to origin/main**
   - `git push origin main`
   - The remote already has authentication configured (token in remote URL).

4. **Verify**
   - Confirm the push succeeded and `main` tracks `origin/main`.
   - Report the landed commit(s) and their SHA.

## When to stop

- Push is rejected by the server (e.g. protected branch, missing permissions).
- A conflict cannot be resolved unambiguously.
- The user has untracked work that would be lost by the merge.

## Notes

- Remote `origin` → `http://192.168.178.21:8929/dpreyl/ZeugDB.git`
- Default branch: `main`
- No CI pipeline or merge-request workflow is configured for this project.
