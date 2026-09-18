# Building Suit — Claude Cowork Hi-Fi HTML Prototype Workflow

> **Goal:** Let Cowork index the repository-native Building Suit design system, regenerate shared components, design and build product screens as a hi-fi Vue/Vite prototype, validate every screen, and prepare evidence for Flutter implementation.

---

## 1. Start Here — Package the Cowork Plugin on Linux

Open a terminal and copy-paste:

```bash
cd /home/tareq/Dev/building-suit
claude plugin validate plugins/building-suit-cowork
python3 scripts/package_cowork_plugin.py
ls -lh dist/cowork/building-suit-cowork.zip
```

Continue only when validation passes and this file exists:

```text
dist/cowork/building-suit-cowork.zip
```

No Git operation is required for this guide.

---

## 2. Upload and Enable the Plugin in Cowork

### 2.1 Upload the ZIP

1. Open Claude Desktop.
2. Switch to **Cowork**.
3. Click **Customize** in the left sidebar.
4. Select **Plugins**.
5. Click the `+` button or **Browse plugins**.
6. Choose the option to upload a custom plugin file.
7. Select `dist/cowork/building-suit-cowork.zip`.
8. Confirm installation.
9. Open the installed **Building Suit Cowork** plugin.
10. Confirm all seven skills are enabled.

### 2.2 Verify the installed skills

In a new Cowork task, type `/` or click `+`.

Confirm these skill labels appear:

- Index Design System
- Plan HTML Prototype
- Bootstrap HTML Prototype
- Materialize Design System
- Build Prototype Screen
- Review Prototype Screen
- Prepare Flutter Handoff

Plugin skill names may appear namespaced, for example:

```text
/building-suit-cowork:index-design-system
```

If Cowork presents human-readable labels instead, select the matching label from the skill picker.

### 2.3 If the plugin does not load

1. Re-run `claude plugin validate plugins/building-suit-cowork`.
2. Re-run the packager.
3. Uninstall only the broken **Building Suit Cowork** plugin entry.
4. Upload the new ZIP.
5. Start a new Cowork task; already-open tasks may retain old plugin metadata.

---

## 3. Create the Cowork Project

Use a Cowork Project rather than unrelated standalone tasks. Projects keep files, context, instructions, and memory together.

1. Open Claude Desktop → **Cowork**.
2. Find **Projects** in the left navigation.
3. Click `+`.
4. Choose **Use an existing folder on your computer**.
5. Select this exact Building Suit repository root:

   ```text
   /home/tareq/Dev/building-suit
   ```

6. Name the project:

   ```text
   Building Suit Hi-Fi Prototype
   ```

7. Paste the following complete block into **Project Instructions**:

   ```text
   You are the file and workflow owner for the Building Suit high-fidelity Vue/Vite prototype.

   The repository directory .docs/building-suit-brand-guidelines owns the
   design-system foundations, canonical tokens, components, typography, imagery,
   assets, and visual language. Cowork indexes it directly, regenerates the
   Vue component surface, and designs product screens from UX/PRD requirements.

   Do not request Claude Design, Google Drive, MCP, or external design-system
   exports. Everything required is already in the selected repository.

   Authority order:
   1. .docs/03. BUILDING_SUIT_UX_SPEC.md for behavior and presentation.
   2. .docs/01.BUILDING_SUIT_PRD.md for product rules and permissions.
   3. .docs/02.BUILDING_SUIT_BRD.md for business context.
   4. .docs/building-suit-brand-guidelines/07-design-tokens/design-tokens.json
      for exact design values.
   5. Final and dedicated brand/UI documents for final brand rules.
   6. Approved prototype control records in `prototype/.design-system-control/`.
   7. .docs/08.BUILDING_SUIT_IMPLEMENTATION_PLAN.md for sequence.
   8. .docs/04.BUILDING_SUIT_SYSTEM_ARCHITECTURE.md for Flutter mapping.

   Do not treat the condensed Claude Design source pack as final authority.
   Brand personality: Trustworthy, Clear, Organised, Warm, Premium.
   Logo clear-space X: one gold window-pane height; 25% total-height is fallback only.

   Run the installed plugin skills in this order:
   1. Index Design System.
   2. Plan HTML Prototype.
   3. Bootstrap HTML Prototype.
   4. Materialize Design System.
   5. Build Prototype Screen.
   6. Review Prototype Screen.
   7. Prepare Flutter Handoff.

   Hard constraints:
   - Building Suit only; no future portal internal UIs.
   - No live Paymob collection.
   - Use Vue 3, Vite, semantic HTML templates, CSS, fixtures, and minimal JavaScript.
   - No React, Angular, Tailwind, shadcn/ui, APIs, Supabase, real auth,
     or production Flutter in the prototype.
   - Do not alter the approved palette, typography, iconography, spacing,
     radii, shadows, or logo artwork.
   - Use Manrope, IBM Plex Sans Arabic, and Hugeicons Stroke Rounded.
   - Support 390 x 844 mobile, light/dark, English LTR, Arabic RTL, keyboard
     focus, reduced motion, safe areas, and 44 x 44 minimum targets.
   - Keep one dominant primary action and one gold focal point per view.
   - Record missing requirements instead of inventing them.
   - Never permanently delete files without my explicit permission.
   - Review plans and file scope before editing.
   - Run the build check and produce comparison screenshots before claiming
     a screen is complete.

   The Vue prototype and JavaScript are evidence only. Never recommend a
   WebView or mechanical HTML-to-Dart conversion.
   ```

8. Add the repository folder as Project context.
9. Create the Project.
10. Confirm the **Building Suit Cowork** plugin is enabled for the Project/task.

### Verification prompt

Start a new task in the Project and send:

```text
Without editing files, state:
1. the responsibility of the repository brand-guidelines directory;
2. the responsibility of Cowork;
3. the responsibility of Claude Code;
4. the UX authority file;
5. the canonical token file;
6. prohibited prototype technologies;
7. the base mobile viewport.
```

Do not continue unless the answer correctly states the three-surface handoff, UX/token authority, Vue/Vite constraint, prohibited frameworks/APIs, and 390 × 844 base.

---

## 4. Index the Repository Design System

No external handoff is required. Cowork can read the canonical design system directly from `.docs/building-suit-brand-guidelines/`.

### 4.1 Start a fresh Project task

Select **Index Design System** or paste:

```text
/building-suit-cowork:index-design-system

Index the Building Suit design system directly from:
.docs/building-suit-brand-guidelines/

Use this authority order:
1. 07-design-tokens/design-tokens.json for exact canonical values.
2. 04-ui-system/ for UI direction, components, light mode, and dark mode.
3. 03-visual-identity/ for color, typography, visual language, layout, icons,
   and imagery.
4. 02-logo-system/ and assets/logos/ for logo rules and approved artwork.
5. 08-final-guidelines/02_BRAND_GUIDELINES_FULL_DOCUMENT.md for complete final rules.
6. exports/ for supporting visual evidence only.

Treat 06-claude-design/00_CLAUDE_DESIGN_SOURCE_PACK.md as orientation only; it
must never override final or dedicated documents.

Create or complete:
- prototype/.design-system-control/01_DESIGN_SYSTEM_MANIFEST.md
- prototype/.design-system-control/02_COMPONENT_CATALOGUE.md
- prototype/.design-system-control/03_SCREEN_DESIGN_APPROVAL_INDEX.md
- prototype/.design-system-control/04_DISCREPANCY_LOG.md

Inventory foundations, semantic tokens, typography, spacing, radii, elevation,
motion, logo rules, iconography, imagery, light/dark behavior, RTL rules,
accessibility rules, and every component with anatomy, variants, and states.

Do not create prototype code or product screens. Do not modify source documents
or assets. Stop for my approval of the indexed design-system contract.
```

### 4.2 Review the index

Reject the result if Cowork:

- treats generated CSS/Flutter files as more authoritative than `design-tokens.json`;
- reads the condensed Claude Design source pack as final authority;
- invents missing components or token values;
- changes source documents or assets;
- starts building the prototype;
- claims product screens already exist.

The component catalogue should include at least the components documented by the repository: buttons, inputs, selects, cards, badges, tabs, bottom navigation, app bar, toasts, modals, payment cards, building cards, and voting cards.

### 4.3 Approve the indexed system

If the manifest, catalogue, and discrepancy log are accurate, reply:

```text
I approve the repository-native Building Suit design-system index.

Use design-tokens.json for exact values and the dedicated UI/visual-identity
guides for component and visual-language rules. Do not build anything in this
task. I will start a new task for prototype planning.
```

---

## 5. Confirm the Design-System Boundary

Before planning screens, send this verification prompt in a new task:

```text
Without editing files, confirm:
1. the design system comes directly from .docs/building-suit-brand-guidelines/;
2. no Claude Design, Google Drive, MCP, or external handoff is required;
3. design-tokens.json controls exact values;
4. Cowork regenerates components in the component lab;
5. Cowork owns product-screen composition from UX/PRD requirements;
6. every screen requires user approval before becoming a baseline.
```

Do not continue unless all six statements are confirmed correctly.

---

## 6. Plan the Prototype

Start a new task and select **Plan HTML Prototype**:

```text
/building-suit-cowork:plan-html-prototype

Plan the Building Suit high-fidelity prototype from the approved repository
design-system index, UX specification, PRD, canonical tokens, and implementation-plan order.

The repository contains system rules rather than product screens. Cowork owns screen design and
composition. Create a design brief for every screen family that maps UX/PRD
requirements to approved design-system components and visual-language rules.

Create traceability and state-control documents only. Do not scaffold or build
screens. Propose the smallest first vertical slice and stop for approval.
```

### Plan approval checklist

- [ ] Building Suit is the only active portal.
- [ ] Screens follow MS-1 through MS-5 sequence.
- [ ] Every screen family maps exact UX and PRD headings.
- [ ] Every screen has a Cowork-owned design brief mapped to exact UX/PRD sources.
- [ ] Every brief names the design-system components and rules it will reuse.
- [ ] Ideal, loading, empty, error, restricted, dark, and RTL states are explicit.
- [ ] Shared components are identified.
- [ ] Missing behavioral requirements or design-system rules are explicit.
- [ ] Login is the first approved vertical slice unless the user changes it.

If the plan passes the checklist, reply with:

```text
I approve the prototype source map, screen/state catalogue, and Login as the
first vertical slice. Do not scaffold in this task. I will start a new task for
the prototype bootstrap.
```

---

## 7. Bootstrap the Prototype

Start a new task and select **Bootstrap HTML Prototype**:

```text
/building-suit-cowork:bootstrap-html-prototype

Use the approved prototype plan. Create infrastructure only: Vue 3, Vite,
semantic templates, CSS, fixtures, compiled dist output, documentation, and
screenshot folders.

Do not create product screens or the component system. Run the build check and
stop for review.
```

Approve terminal commands only when they operate inside the selected repository. Review dependency installation before allowing it.

Reject the scaffold if it adds React, Angular, Tailwind, shadcn/ui, Supabase, APIs, real auth, or a second UI framework.

If the scaffold builds and respects the constraints, reply with:

```text
I approve the prototype scaffold. Do not create screens in this task. I will
start a new task to materialize the design system components.
```

---

## 8. Materialize the Repository Design System

This stage regenerates the documented repository system as shared Vue components and CSS. It must happen before product screens.

Start a new task and select **Materialize Design System**:

```text
/building-suit-cowork:materialize-design-system

Materialize the approved repository design-system index as Vue components,
semantic CSS tokens, layout primitives, and fixtures.

Use design-tokens.json for exact values. Use the dedicated UI and visual-identity
guides for component anatomy, visual treatment, density, and imagery. Regenerate
the documented components; do not copy external generated code. Do not create
product screens.

Build and capture shared-component mobile light, dark, and RTL views. Stop for my
approval.
```

### Component approval gate

- [ ] Exact canonical colors and roles.
- [ ] Manrope and IBM Plex Sans Arabic.
- [ ] Hugeicons Stroke Rounded.
- [ ] Approved spacing, radius, shadow, and component anatomy.
- [ ] Every indexed component and variant represented.
- [ ] Focus, disabled, loading, error, selected, and pressed states.
- [ ] Light, dark, LTR, and RTL.
- [ ] Reduced motion and 44 × 44 targets.
- [ ] Visual comparison screenshots recorded.
- [ ] No product screens yet.

Do not proceed until the component lab matches the repository component/UI guides and supporting `exports/ui-components.png` evidence.

If the component lab passes every item, reply with:

```text
I approve the component lab as the reusable UI baseline for the prototype.
Future screens must reuse these tokens, primitives, components, and states.
Do not build a product screen in this task.
```

---

## 9. Build the Login Screen First

The Login screen is the first anchor screen. The repository supplies system rules rather than a screen composition, so Cowork must create it. Start with two distinct system-compliant directions, choose one, then use that choice to guide later screens.

### 9.1 Build the auth flow baseline

Start a new task and select **Build Prototype Screen**:

```text
/building-suit-cowork:build-prototype-screen

Screen family: Authentication
Mode: Vue hi-fi implementation
Route/hash targets: #login, #register, #verify-phone, #verify-email,
#reset-request, #new-password, #one-last-step
Roles: unauthenticated visitor
Required states: ideal, invalid credentials, processing, network error,
fingerprint unavailable, dark mode, Arabic RTL
UX sources: §1.1–1.3; §2.2–2.3 including Authentication presentation behavior;
§3.1; §4.1–4.2; §5.4
Input behavior: use associated floating labels for text fields; the label rests
inside an empty inactive field and floats to the top of the field on focus or
once filled. Placeholder text is supplemental only, never the label.
PRD sources: §3.1 and E1 user stories
Implementation sources: MS-1, FEAT-104, FEAT-105
Design-system sources: approved manifest, component catalogue, canonical token
JSON, component lab, and relevant visual-language rules
Verification: 390 × 844 light LTR, dark LTR, light RTL

There is no pre-existing approved Login screen. Cowork owns the composition.

First write a concise Login design brief from the named UX/PRD sources. Then
create two genuinely different, polished composition directions using the same
approved design system. Differences must come from hierarchy, layout, density,
imagery/motif placement, and interaction emphasis—not from changing tokens or
inventing components.

Avoid generic AI styling, decorative gradients, glassmorphism, excessive cards,
and arbitrary gold decoration unless the imported system explicitly permits it.
Keep one dominant primary action and one intentional gold focal point.

Use fixtures only. Do not implement real authentication, OAuth, biometrics,
APIs, Supabase, or persistence. Build and capture both directions. Record both
in `prototype/.design-system-control/03_SCREEN_DESIGN_APPROVAL_INDEX.md` with approval pending.
Stop and ask me to choose A, B, or specific elements to combine.
```

### 9.2 Choose a direction

After reviewing the screenshots, reply with one of these:

```text
I approve Login direction A. Promote it to login.html and treat its composition
language as the baseline for authentication screens. Do not retain direction B
as an active product screen.
```

```text
I approve Login direction B. Promote it to login.html and treat its composition
language as the baseline for authentication screens. Do not retain direction A
as an active product screen.
```

Or use this controlled-combination prompt:

```text
Create the final login.html using direction <A/B> as the base, with only these
elements from direction <B/A>:
- <specific element>
- <specific element>

Do not introduce a third visual direction. Preserve the approved design system,
all required states, dark mode, and Arabic RTL. Update the screen design/approval
index and stop after final screenshots.
```

---

## 10. Review Before Fixing

Visual review is separate from implementation so Cowork does not quietly rationalize its own output.

Start a new task and select **Review Prototype Screen**:

```text
/building-suit-cowork:review-prototype-screen

Target: login.html
States: ideal, invalid credentials, processing, fingerprint unavailable
Viewports: 390 × 844 light LTR, dark LTR, light RTL
Approved screen decision: use the user-approved Login direction and design brief
from `prototype/.design-system-control/03_SCREEN_DESIGN_APPROVAL_INDEX.md`
Design-system sources: manifest, component catalogue, canonical tokens, and
component lab

Compare geometry, hierarchy, tokens, typography, components, spacing, imagery,
states, scrolling, focus, RTL, dark mode, and reduced motion against the approved
Cowork design decision, UX requirements, and design system. Record findings and
screenshots only. Do not edit the implementation.
```

Review the findings. Then start a separate Build Prototype Screen task scoped only to the selected defect IDs.

Do not say “make it look better.” Provide defect IDs or precise differences from the approved brief, system rule, or UX requirement.

Copy-paste this into the separate repair task after selecting the defect IDs:

```text
/building-suit-cowork:build-prototype-screen

Revise only login.html and only these approved visual-QA defects:
- <DEFECT-ID>: <exact recorded mismatch>
- <DEFECT-ID>: <exact recorded mismatch>

Preserve the approved Login composition and design-system mappings already
recorded in the screen design/approval index.
Do not redesign unaffected areas. Do not add dependencies, APIs, real auth, or
new behavior. Rebuild, capture the three required views, update QA records, and
stop for another independent review.
```

---

## 11. Continue Screen by Screen

Use this template for each approved screen family:

```text
/building-suit-cowork:build-prototype-screen

Screen family: <one family>
Pages: <exact pages>
Roles: <exact roles>
Required states: <explicit states>
UX sources: <exact headings>
PRD sources: <exact headings>
Implementation sources: <exact feature/task IDs>
Approved composition baseline: <approved related Cowork screen/shell pattern>
Design-system sources: <exact components and visual-language rules>
Verification: 390 × 844 light LTR, dark LTR, light RTL

There is no pre-existing product-screen reference. Create the screen composition
from the named UX/PRD requirements, approved Cowork shell/patterns, and indexed
design system. Reuse the component lab. Use fixtures only. Do not add APIs,
Supabase, real auth, production logic, or unsupported portals. Record the design
brief and composition decision, update every control document, and stop after
screenshots for user approval.
```

Recommended order:

1. Login.
2. Registration and verification.
3. Password recovery.
4. Welcome and building context.
5. Create/join building.
6. Home dashboard and shell.
7. Finance overview/history.
8. Finance actions.
9. Issues and announcements.
10. Governance/elections.
11. Services/providers.
12. Notifications/profile/preferences.

Run a separate Review Prototype Screen task after each family.

---

## 12. Prepare the Claude Code Handoff

After all approved screen families pass visual QA, start a new task and select **Prepare Flutter Handoff**:

```text
/building-suit-cowork:prepare-flutter-handoff

Prepare the approved repository design system and Cowork HTML prototype as evidence for
Claude Code to implement the production Flutter app.

Verify source, screen, state, screenshot, QA, token, component, accessibility,
RTL, and widget mappings. Complete `prototype/docs/FLUTTER_HANDOFF.md` and write
the ready-to-paste Claude Code kickoff prompt.

Do not implement Flutter and do not recommend WebView or mechanical HTML-to-Dart
conversion.
```

When Cowork reports that the Flutter handoff is complete, reply with:

```text
I approve the Cowork prototype handoff as implementation evidence for Claude
Code. The HTML/CSS/JavaScript prototype is visual and behavioral evidence only;
Claude Code must implement the production application natively in Flutter from
the approved architecture and requirements.
```

### Required handoff package

```text
CLAUDE.md
.docs/01.BUILDING_SUIT_PRD.md
.docs/03. BUILDING_SUIT_UX_SPEC.md
.docs/04.BUILDING_SUIT_SYSTEM_ARCHITECTURE.md
.docs/08.BUILDING_SUIT_IMPLEMENTATION_PLAN.md
.docs/building-suit-brand-guidelines/07-design-tokens/design-tokens.json
prototype/.design-system-control/
prototype/src/
prototype/dist/
prototype/docs/
prototype/screenshots/
```

Claude Code should use Flutter architecture decisions from the architecture document and visual/behavior evidence from the approved handoff. It must not inherit web architecture.

---

## 13. Test the Same Plugin in Claude Code

The plugin is compatible with Claude Code as well as Cowork.

From the repository root:

```bash
claude --plugin-dir plugins/building-suit-cowork
```

Then type `/` and confirm namespaced Building Suit skills appear. This is useful for validating the final handoff, but do not begin Flutter implementation until Cowork completes the handoff gate.

Root `CLAUDE.md` provides shared instructions to Claude Code automatically.

---

## 14. Token and Context Discipline

- Use one Cowork task per major stage or screen family.
- Use the plugin skill appropriate to the current stage.
- Do not attach all product documents manually; the selected folder already contains them.
- Read only exact headings named by the source map.
- Use the indexed manifest/catalogue and exact source paths instead of repeatedly reading the entire brand-guidelines tree.
- Use screenshots only for the current screen and state.
- Keep findings concise and source-linked.
- Archive completed Cowork tasks within the Project rather than mixing several screen families in one task.
- Do not install generic creativity skills that override the repository design system.

---

## 15. Recovery and Troubleshooting

### Cowork does not open or cannot execute tasks on Linux

Restart Claude Desktop, confirm Cowork opens, confirm the repository folder is authorized, and start a new Project task. This guide assumes your working Linux Claude Desktop installation.

### Skills do not appear

Re-upload the validated ZIP, confirm the plugin is enabled, and start a new task. Use `/` or `+` to search by the human-readable skill name.

### Cowork cannot see repository files

Confirm the Project uses `/home/tareq/Dev/building-suit` as its existing folder and that folder access was approved. Do not attach only `.docs/` or a subdirectory.

### The plugin asks for Claude Design, Google Drive, or MCP

Remove the old plugin and upload version `2.0.0` or later. The current plugin reads `.docs/building-suit-brand-guidelines/` directly and requires no connector.

### Cowork cannot find the design-system source

Confirm these paths exist inside the selected folder: `.docs/building-suit-brand-guidelines/07-design-tokens/design-tokens.json`, `04-ui-system/02_COMPONENT_STYLE_GUIDE.md`, and `08-final-guidelines/02_BRAND_GUIDELINES_FULL_DOCUMENT.md`.

### Cowork reads too many documents and wastes context

Use the indexed manifest/catalogue and exact source-map headings. Do not repeatedly read the full 2,307-line final document or the complete brand-guidelines directory for each screen.

### Cowork asks for an external design-system handoff

Correct the task: everything required is in `.docs/building-suit-brand-guidelines/`. Run **Index Design System** and do not add external sources.

### Cowork asks for a pre-existing screen reference

Correct the task: the repository provides the design system, not product screens. Cowork must create the screen from UX/PRD requirements and record its own design brief/composition decision.

### Cowork ignores the design system while creating a screen

Stop the task. Confirm the system manifest and component lab are approved, identify the exact violated token/component/rule, and re-run the screen task with that evidence named explicitly.

### A guideline conflicts with canonical tokens

Record the conflict in `04_DISCREPANCY_LOG.md`. Canonical JSON controls exact values unless a human approves a source update.

### A screen has no composition yet

This is expected. Cowork must create a design brief and composition from UX/PRD requirements using the indexed system, then stop for user approval before the screen becomes a baseline.

### Cowork wants to delete files

Reject deletion unless the exact files are reviewed and removal is intentional. Cowork requires explicit permission for permanent deletion.

---

## 16. Definition of Done

### Setup

- [ ] Claude Desktop and Cowork working on Linux.
- [ ] Plugin validates and packages.
- [ ] Custom plugin uploaded and seven skills visible.
- [ ] Repository brand-guidelines sources and assets are readable.
- [ ] Plugin version `2.0.0` or later requires no external connector.
- [ ] Cowork Project created from repository root.
- [ ] Folder instructions installed and verified.

### Design-system index

- [ ] Canonical source paths, index date, foundations, components, and rules recorded.
- [ ] Source documents and assets preserved unchanged.
- [ ] Manifest, component catalogue, screen design/approval index, and discrepancy log complete.
- [ ] Canonical tokens reconciled.
- [ ] Missing design-system states/modes/rules explicit.
- [ ] User approved the repository design-system index.

### Prototype

- [ ] Source plan approved.
- [ ] Vue/Vite scaffold builds.
- [ ] Shared Vue components match the repository component/UI guides and are approved.
- [ ] Each screen family maps exact UX/PRD sources, design-system rules, and a Cowork design brief.
- [ ] Each screen composition is explicitly user-approved.
- [ ] Each screen passes separate visual QA.
- [ ] Dark, RTL, focus, reduced motion, and target sizes verified.
- [ ] No APIs, real auth, Supabase, unsupported portals, or production Flutter added.

### Claude Code handoff

- [ ] Readable Vue source and compiled dist output included.
- [ ] Acceptance screenshots included.
- [ ] Token-to-theme and component-to-widget mappings complete.
- [ ] Open decisions explicit.
- [ ] Claude Code kickoff prompt prepared.
- [ ] Vue prototype clearly labeled as evidence rather than production architecture.
