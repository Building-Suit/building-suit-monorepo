---
name: review-prototype-screen
description: Perform browser/computer-use visual QA on one Cowork-designed Building Suit prototype page against its approved design brief, indexed repository design system, UX behavior, tokens, states, accessibility, dark mode, and RTL requirements. Use after a screen builds or when visual quality is questioned.
---

# Review One Prototype Screen

## Workflow

1. Require a target page, state list, viewports, approved Cowork design brief/composition decision, and relevant design-system rules.
2. Run the build check and start the local prototype server.
3. Inspect at minimum:
   - 390 × 844 light LTR;
   - 390 × 844 dark LTR;
   - 390 × 844 light RTL;
   - the approved larger reference viewport when applicable.
4. Compare composition, geometry, hierarchy, typography, token use, component treatment, imagery, spacing, scrolling, states, and motion to the approved design brief and indexed repository design system.
5. Check keyboard focus, target sizes, contrast, semantics, reduced motion, overflow, safe areas, and RTL mirroring.
6. Save deterministic screenshots and update `prototype/docs/VISUAL_QA.md` with pass/fail evidence.
7. Do not silently redesign or fix the page during the review.
8. Categorize findings as design-brief mismatch, behavior mismatch, system/token mismatch, accessibility defect, implementation defect, or missing decision.
9. Stop for user selection of the defects to fix.
