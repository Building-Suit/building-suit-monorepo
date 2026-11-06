# HQ module recovery — 4 November 2026

The founder explicitly authorized this regression exception: “still shows, fix it and test it yourself to see if it works”. The standing ban remains for unrelated testing.

Parent-task observations: `http://127.0.0.1:3101` still returned HTTP 500 before restart, although the helper existed and direct Node import succeeded. The parent restarted only the HQ process group and launched `pnpm dev:hq --current`. Source `f86f6e2b` remained unchanged; no new source/config fix was needed. The fresh HQ request returned HTTP 200, consistent with stale development SSR module state cleared by restart.

The in-app browser reload rendered the orb/base/floor and CEO workspace. Brain opened, showed cloud connection and loaded the note index; zoom was disabled while open and restored on close. Zoom In reached 120%; Reset returned to 100%. Browser logs contained no warning/error entries in the observed run.

This is a targeted recovery smoke result, not general visual/performance, Auth/approval or other-product acceptance. No full test/build/lint/typecheck/boundary/release suite, provider mutation or Brain write was performed for this recovery.
