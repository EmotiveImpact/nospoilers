# Base UI rollout — deferred for next session

Owner decision, 8 September 2026: save this proposal and pick it up later.

Start Gate C with shared NoSpoilers controls built on Base UI: menus, tooltips, dialogs, selects and switches. Preserve the existing visual identity and working API/permission logic.

First reviewable slice: workspace switcher and Notifications settings. Verify mobile positioning, keyboard navigation, focus return, opening/closing and save/error feedback. Review the result with the owner before expanding across the application. Replace existing controls progressively; do not rewrite completed product flows.

Loading presentation decision: retain the lighthouse for initial Watch loading. Use existing WatchSkeleton components for page and section data loading, with accessible status announcements and reduced-motion support. Keep operation feedback (saving, uploading, scanning) distinct from page loading.

The old-to-new settings/feature parity audit remains deferred by the owner. Gate B acceptance is recorded in GATE-B-FINAL-EVIDENCE-MATRIX.md; this rollout belongs to Gate C. Follow WEB-APP-ARCHITECTURE.md for architectural changes.
