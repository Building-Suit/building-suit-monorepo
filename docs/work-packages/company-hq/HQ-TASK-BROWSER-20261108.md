# HQ task browser — 8 November 2026

Founder request: edit the primary checkout directly for the local runner. Office
Running Tasks becomes Tasks. Both Office and header Tasks use All, Running,
Waiting and Done with full-scope counts; All renders at most four cards in each
section. Header cards additionally show owner name, role and department.

Shared `BsHqTaskBrowser` and `BsHqTaskWindow` render the same list in both places.
`useWindowedList` owns fixed-height lazy windows: at most four summaries per All
section or twelve in an individual status tab. Scrolling forward or backward
replaces the previous window; spacer heights preserve the scroll range. Requests
are aborted/superseded on scroll, office/filter/revision change and disposal.
Cards retain title/status/date; full brief, criteria, result and review are read
only when opened in the existing task detail UI. Running means working/review;
Waiting includes queued/blocked; Done includes completed/canceled, retaining the
actual status. Canceled tasks do not gain completed-task follow-up eligibility.

Product adapters own requests and projection. The founder-only no-store GET
`/api/hq/tasks` uses the existing fresh session, origin/header and immutable
HQ environment checks. Versioned migration `20261108041146_hq_task_browser.sql`
adds a private founder-authorized read function, invoker API wrapper and index.
Counts and summaries come from one scoped SQL statement with deterministic
created-at/id ordering. No table grants, writes or worker permissions change.

**Rollout pending:** the migration is source-only. This local-only request does
not authorize a hosted mutation, Git publication, integration or deployment.
Before the migration is rolled out through the maintained repository workflow,
a 503 response can display the existing bounded recent snapshot, clearly marked
incomplete, with full totals hidden. It cannot browse history outside that
snapshot. Full task details remain available only for records already present
in the full snapshot. Other failures retain the error/retry state; access loss
clears the UI and invalidates pending responses. The local preview is therefore
not evidence of complete history/count behavior before migration rollout.

Preflight fetched live GitHub state: primary checkout `stg` at `02510bb3` is two
commits behind `origin/stg` at `cb6dbfbb` (#544, task-evidence continuity). Its
listed upstream files do not overlap this task. No branch switch, reset, stash,
worktree, commit, push or merge was performed; local changes remain in place.

Source changes and catalogue fixtures prepared. Tests, builds, lint, typecheck,
boundary/release checks, SQL execution, browser/API/runtime checks and independent
review remain **unrun** under the standing HQ restriction. No rendered acceptance,
measured memory/performance result, hosted migration or deployment is claimed.

## Follow-up: new work starts in Chat

Removed manual task creation and follow-up queueing from Tasks, and removed the
direct task creation POST from the local HQ application. Live meeting controls
and the application API no longer accept new research, plan drafting or approval
that can dispatch work. Agent details retain qualification decisions on existing
reviewed trials, without direct trial creation. Meeting conversation, existing
company and staffing proposal review, task history and worker processing remain
available. The synthetic demonstration remains isolated. No hosted database
ACL, worker capability, deployment or Git publication change was made.
Existing browser fixtures were updated for the changed entry points; no tests
or browser checks were run. This follow-up's Git preflight timed out fetching
upstream, so current GitHub state was not verified.

## Follow-up: independent header sidebars

Tasks, Team, Learning and Company plans now open their own titled sidebar from
header buttons. They share the existing sidebar focus and Escape handling and
do not select a workplace or move the camera. Tasks retains All, Running, Waiting
and Done. The old CEO Workspace tab strip is removed; explicit office selection
and Office tabs retain their camera and scope. Company plans retains founder
access, plan review and staffing decisions. Header controls wrap on narrow
screens. Existing fixture selectors were updated; browser checks remain unrun.

## Follow-up: sidebar details and Team org chart

All now requests and shows at most three cards per status with no inner
scroller or spacer. Dedicated status tabs retain bounded lazy browsing. The
HQ header, Office tabs and task filters share the header tab style. Panel
headers and Office tabs are outside the scrolling body; task filters pin to
the top of that body. Refresh controls are labeled icon buttons, and external
destinations keep safe navigation while using the bordered button style.

Task, learning, Brain note, company plan and staffing records open in a wider
detail sidebar beside the originating panel. On narrower screens the detail
panel overlays its source; closing it restores the source and opener focus.
Existing Office employee inspection uses the same wider panel sizing. External
profile and source destinations retain their existing navigation.

Team now opens an 84vw × 84dvh centered modal with top-down entrance and
reduced-motion support. The org chart uses the existing founder-scoped roster
and manager IDs. Department boxes are labeled background layers; missing or
cyclic manager references do not create reporting lines. The chart scrolls
independently and employee selection opens a detail overlay with its own fixed
header and scroll body. Closing details keeps the org chart open and restores
focus to the employee card.

Changes are local. Preflight read the current GitHub state and reported the
checkout two commits behind staging; no pull or publication occurred. Updated
synthetic catalogue and browser fixtures are source only. No build, tests,
browser acceptance, deployment or database change ran.

## Follow-up: Team visual styling

Team and its employee inspector now use the same canonical HQ glass surface
as the workspace sidebars. The inspector enters from the left, uses the same
panel width, and keeps its title and close button above the scrolling content.
Chart cards have initials avatars, clearer names and roles, and a separate
observed activity or connection indicator. Department counts and softer
reporting lines improve scanning without changing the reporting data.
Source only. Browser verification remains unrun; this follow-up's Git
preflight timed out.

## Follow-up: Team uses the workspace sidebar

Team is now a non-modal HQ panel with the same vertical bounds as the other
sidebars. It spans the workspace between the side gutters and enters from
the top. It does not use a scrim or modal focus trap. An employee card opens
the original HQ employee sidebar as a sibling panel, with the existing
founder and qualification controls. Closing employee details returns focus
to the chart and leaves its scroll position intact. This supersedes the
earlier Team modal and its inner drawer. Local source only; browser
verification is unrun. Git preflight timed out.

## Follow-up: radial Team org chart

The Team chart uses the founder's reference for its radial layout. The CEO
avatar anchors the center, with circular employee nodes and labeled department
rings around it. Actual manager IDs still determine connectors; a department
ring does not imply a reporting relationship. Group spacing accounts for
different roster sizes. The chart fits when possible and stays scrollable when
further shrinking would make labels hard to read. Employee selection still
opens the existing HQ employee sidebar. Local source only; no browser
verification or hosted change. Git preflight timed out.

## Follow-up: readable chart and independent navigation

The Team chart opens centered at a readable scale. Department circles use
space proportional to group size; higher-contrast multiline labels and clearer
reporting lines retain the radial layout. The chart toolbar provides zoom in,
zoom out, fit, and a 100% recenter action on the zoom readout. The chart
supports mouse and touch dragging, native scroll, keyboard zoom and fit, and
Ctrl/Command plus wheel zoom. Dragging suppresses the resulting click; regular
clicks and keyboard activation open the original employee sidebar. The
chart viewport is separate from the HQ scene camera. Source only: browser
verification is unrun and Git preflight timed out.

## Follow-up: light organization map and free canvas panning

The Team panel follows the founder's latest light reference. Department cards
show the actual roster, initials and counts around the navy and gold CEO
medallion. Gold spokes indicate departments in the organization; employee
manager information remains in the existing employee sidebar. Organization,
Departments and People are functional views and the search filters the current
roster. Large departments expose their full member list in Departments.

The map pans with a two-axis transform rather than moving scroll offsets.
The canvas has no scrollbar and supports mouse or touch drag, keyboard pan,
wheel and button zoom, Fit, and reset. Clicking an employee still opens the
existing sidebar. Source only; no browser verification or hosted changes.
Git preflight timed out.

## Follow-up: Team matches the HQ sidebar theme

The Team panel uses the shared navy glass background. The duplicate Building
Suit HQ lockup inside the panel was removed. Organization, Departments and
People use the shared HQ header tab variant. Department cards and chart
navigation retain their existing composition and behavior. Browser
verification remains unrun.

## Follow-up: Learning and Company plans

Brain now has fixed Notes and Learning tabs. Learning uses the founder-gated
receipt list and opens receipts in the existing detail sidebar. Company plans
opens in the same centered, 85%-wide, top-sliding panel as Team. The board
groups company and staffing proposals in Pending discussion, In preparation,
Blocked and Done. Done refers to a closed decision. Approved staffing proposals
with a publication blocker stay in Blocked. A note opens the existing record
sidebar for the full proposal, reviews and available founder actions. The
board reads the existing HQ projections and keeps plan creation in Chat.

Source updated in the primary checkout. Browser and automated verification
remain unrun under the founder's scoped HQ instructions.
