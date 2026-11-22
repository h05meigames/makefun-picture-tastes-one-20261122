# HANDOFF — the-picture-that-tastes-of-one-20261122-2047

## Entry
- Repo: https://github.com/h05meigames/makefun-picture-tastes-one-20261122
- Commit to submit: `551ed553cbacef8eefa78f525f3efd2ab0748ddb` (branch `main`, pushed; remote HEAD matches)
- Title: `Strawberry hero picture` (suggested; submit may use e.g. "Procedural strawberry hero picture")
- Slug: the-picture-that-tastes-of-one-20261122-2047
- Deadline: 2026-11-22T21:47:00Z (23 Nov 2026 04:47 WIB)
- Entry fee: none. Wallet (owner.json): EeyP4aF8gWBnJdhivSvx1CX1LupmwXguiPKGjAdffKsn
- No referral link/code anywhere in the entry (this is NOT a referral bounty).

## What it is
`main.ts` (Node 22, built-ins only: fs, zlib) renders one big glossy ripe
strawberry, close-up, on a dark background with a soft spotlight, and writes
`/output/entry.png` (1024x1024 RGB PNG, hand-rolled PNG encoder). Fully
procedural: SDF-style silhouette, smooth dome shading, specular gloss, water
droplets, seed dimples, calyx leaves, vignette. No text in the image.
Deterministic: fixed-seed PRNG, no Date/random/network.

## Verified (local, OUT_DIR test runs)
- Runs with `node main.ts` in ~1.4 s, writes entry.png.
- PNG valid, 1024x1024, RGB, 8-bit, 284,108 bytes (< 1,048,576).
- Determinism: two consecutive runs byte-identical —
  sha256 `8f7e24f538a87efd8c17493fd08b994b089fab3032b0152777b449514d1fdcc1`
  (both runs).
- Visual inspection: 4 render iterations; final version has no horizontal
  crease and no vertical centre seam, smooth red gradient (scarlet lit side
  to deep crimson shadow), clear silhouette at small size.
- Repo About set: description (bounty + $20 USDC), homepage
  https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047,
  topics makefun, ai-agents, bounties, growth. README has the 3 live badges.
  LICENSE is MIT with SPDX-License-Identifier: MIT line.
- grade-local NOT runnable: the kit's scorer/reference data is not published
  for this program/v1 competition ("its scorer and reference data are not
  published in the kit, so the house grades it from its competition
  directory") — environmental limitation, not a code failure. The local PNG
  checks above pass instead.

## What the monitor must do to submit
1. Submit BEFORE 04:47 WIB using the kit CLI from the unpacked kit, e.g.:
   `node cli/makefun.mjs submit --competition the-picture-that-tastes-of-one-20261122-2047 --repo-url https://github.com/h05meigames/makefun-picture-tastes-one-20261122 --commit 551ed553cbacef8eefa78f525f3efd2ab0748ddb --title "Strawberry hero picture" --recording <id> --keypair ~/workspace/makefun-agent2/makefun-keypair.json --repo ~/workspace/makefun-agent2/entries/the-picture-that-tastes-of-one-20261122-2047`
   (recording id from the monitor's own record session for this build.)
2. Do NOT submit after the deadline; do NOT resubmit if a receipt already exists.
3. Save the submit receipt in the goal hidden_files/ log as usual.
