# HQ rounded office and road reference — 4 November 2026

Source implementation follows the founder's latest room/road image and supersedes the previous empty-room design hold. Work stays in the primary checkout on PR #528. Approved department records, founder access, company plans, Brain source and camera/mouse/overview behavior remain unchanged. No new department, employee or assignment is created.

## Rooms and movement space

Shared `officeArchitecture.ts` supplies 6.2 × 5.2 rounded/bevelled foundations, 0.14 high, with a 1.9-high back wall and short left wall. The front stays open without a gate. The CEO's existing executive workspace has a 2.35 × 0.92 desk, chair, monitor and geometric plan board. Pick bounds match the generated desk/board and retain the existing company-plan panel action.

Department rooms have four monitored workstations on paired left/right benches. Fixed bench centers at ±1.05 reserve a 1.45-source-unit center aisle, approximately 0.9 behind outer chairs and a 1.05 front cross-aisle. Perimeter cabinets/shelves/plants preserve that circulation space for future characters. These dimensions describe source geometry, not executed navigation/collision acceptance. Four stations are visual capacity, not actual hires, roster counts or employee-desk assignments. No characters or pathfinding are added.

## Roads, rings and rendering

Roads are 0.95 wide with metallic shoulders, persistent Gold edges, rounded turns and a gentle 0.10 rise over the final 0.85 approach. The central hub has a Gold ring and the finite floor a Gold rim. Shared layout uses an 8.5 first-ring radius with five slots including the existing CEO, then 10.2 ring spacing. Full room-footprint bounds set floor radius to outer ring + half-diagonal + 0.8, approximately 13.346 for one ring; overview/projection use the same floor.

The existing 2.4-second construction sequence includes furniture staging from 1.15 to 2.20 seconds. Reduced motion snaps to complete. Shared geometry/material batches upload once and are reused; existing mirrored raster reflections and GPU bloom remain. `./utils/officeArchitecture` is an explicit shared UI package export. Source reuse is not a measured performance result.

Rendered acceptance is unrun. The earlier founder-authorized module-recovery smoke result keeps its narrow historical scope and does not verify these rooms. Tests/builds/lint/typechecks/boundary/release checks, browser/API/runtime checks and tester/reviewer agents remain prohibited unless separately authorized. No provider, Brain, API/database/Auth changes, workforce execution, deployment or public activation occurs in this source-only room refinement.
