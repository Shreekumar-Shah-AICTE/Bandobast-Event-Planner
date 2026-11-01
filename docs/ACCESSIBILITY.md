# Accessibility

Bandobast aims at **WCAG 2.2 level AA**. This page lists what the app does and how each part is checked. The README has the [short version](../README.md#accessibility-wcag-22-aa).

## Structure

- A skip link is the first thing on every page, followed by the `header`, `main` and `footer` landmarks and one `h1` per screen.
- The page language is `en-IN`.
- Tables for the budget, quotes and the What changed report have captions and header scopes.

## Keyboard

| Key | Where | What it does |
| --- | --- | --- |
| Tab, Shift+Tab | Everywhere | Moves through links, buttons and fields in reading order. Focus is always visible. |
| Arrow Left, Arrow Right | Plan tabs | Moves to the previous or next tab and shows it (WAI-ARIA tabs pattern) |
| Home, End | Plan tabs | Moves to the first or last tab |
| Enter, Space | Buttons and links | Activates them. Every action is a real `button` or `a`, never a clickable `div`. |

Tab panels take focus when they start with plain text, so keyboard users reach the content right after the tab. There are no modal dialogs and no keyboard traps.

## Focus

Focus moves to the heading of each new screen, to the change preview and to the What changed report. After an edit, a cancel or a quote action, it stays on, or returns to, the part of the page the user was working in.

## Forms

- Every control has a visible label, and hints are linked with `aria-describedby`.
- Errors appear in a summary at the top that links to each field. The fields themselves get `aria-invalid` and their own error text.
- The city field uses `autocomplete="address-level2"` (WCAG 1.3.5).

## Announcements

Live regions report AI progress and results, saves and quote actions, so screen-reader users hear what happened without moving focus.

## Visual design

- Text and controls meet AA contrast, which the axe checks below verify on every screen.
- Buttons, choice controls, expandable summaries and links on their own line (Google Maps, Google Calendar) are at least 44 px tall (WCAG 2.5.8 asks for 24 px).
- Status is never shown by colour alone: badges such as Late, On track, Estimate or Booked carry words. Symbols such as the ₹₹ cost levels have words for screen readers, and decorative icons are hidden from them.
- Animations and transitions stop under `prefers-reduced-motion`. In Windows high-contrast mode (`forced-colors`), badges keep a visible border.

## How it is checked

| Check | What it covers | Where |
| --- | --- | --- |
| axe-core in Playwright | WCAG 2.0 to 2.2 A and AA rules on the welcome screen, the form with its error summary, the change preview, the What changed report and every plan tab, on desktop and mobile | `e2e/plan.spec.ts`: "every screen passes an automated WCAG 2.2 AA check" |
| Keyboard journey | The skip link comes first, and the tabs work with the arrow keys, Home and End | `e2e/plan.spec.ts`: "the skip link comes first and the tabs work from the keyboard" |
| Lint | `eslint-plugin-jsx-a11y` in strict mode on every component, with zero warnings allowed | [`eslint.config.js`](../eslint.config.js) |
| Component tests | Elements are found by role and accessible name, so a missing label fails a test. Focus moves and announcements are asserted. | `src/ui/**/*.test.tsx` |

Automated checks find only part of the possible problems, so changes to the UI also follow the rules in [CONTRIBUTING.md](../CONTRIBUTING.md).
