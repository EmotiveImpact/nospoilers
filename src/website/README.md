# Public website presentation

This directory contains public, customer-facing content and presentation only. It must not import authenticated controllers, server modules or internal planning files.

`model.ts` defines the shared structured article format. The same content supplies the article renderer, topic navigation and entirely local search index. HTML templates escape every text/code value and allow only explicit local, HTTPS or mailto links. `controller.ts` progressively enhances the rendered content with native browser interactions. The small React adapter mounts these listeners and disposes them on route changes; it does not implement another application router.

Capture review is development-only and requires `VITE_WEBSITE_CAPTURE_REVIEW=1`. Do not add unapproved product images. See `docs/WEBSITE-IMAGE-CAPTURE-PLAN.md`.
