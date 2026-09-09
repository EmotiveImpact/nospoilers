# Gate C external verification checklist

Status: unperformed. These checks require an actual browser zoom setting and audible assistive technology; viewport simulation, screenshots and ARIA inspection do not substitute for them. Preserve real workspace state and do not submit scans, reviews, token actions or provider changes.

Record browser/version, OS, assistive technology/version, commit, date, route and result for each observation.

## Native 200% zoom

Use the browser's actual page zoom at200%, recording that setting. Inspect Overview, search results, Alerts queue/detail, Coverage detail, Releases and expanded review/rebuild/history forms, Scan and a settings form. Verify all content/actions remain reachable, text is readable, controls do not clip, and horizontal scrolling is local to any intentionally scrollable content. Open and dismiss a dialog; verify focus remains visible. Restore normal zoom afterward. Record any exact control/route that fails.

## Spoken screen-reader checks

With an actual screen reader, navigate page headings/landmarks, sidebar links and form controls. Verify page-change context, labels/help, selected alert tabs and scoped search results are announced. Search by keyboard, change its active result and dismiss it; verify focus returns to its trigger. Open/dismiss Add coverage and verify title, contained focus and return. On a safe test workspace/fixture, verify an error announcement and expired-trial covered controls are excluded while recovery actions remain available. Do not change the real customer's access to produce these states.

## Reporting

For each check, record pass/fail/unavailable with observed output and reproduction steps. A single passing route does not establish whole-app compliance. These results must be reviewed before closing C2; this checklist itself is not acceptance evidence.
