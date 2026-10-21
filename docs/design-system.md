# Design system (Phase 1, Step 1.5)

The source reference is [the Figma wireframes](https://www.figma.com/design/2HViNFR9Qmm1jSBDBcQ6F8),
especially frames `1:2` (Trips), `1:15` (Dashboard), and `1:60` (Manual entry).
This step implements their shared visual language. Trip data and flight forms
remain in their planned Phase 2 steps.

Run `yarn dev` and open [the component preview](http://localhost:3000/design-system).
It is available only in development and returns 404 in production. It uses no
database, makes no account changes, and demonstrates all twelve core components.

## Tokens and layout

Tokens live in `src/app/globals.css` and are exposed as Tailwind utilities.
Use semantic utilities such as `bg-surface`, `text-secondary`, and `border-border`
rather than introducing new shades in components.

| Token | Value | Use |
| --- | --- | --- |
| Background | `#0e131d` | Page background |
| Card surface | `#1b2230` | Cards, form controls, navigation |
| Elevated surface | `#1f304a` | Summary panels, active navigation |
| Brand strip | `#131b29` | Header background |
| Primary text | `#f0f5fc` | Headings and body text |
| Secondary text | `#abbacf` | Supporting text |
| Accent | `#619eff` | Links and focus outlines |
| Primary button | `#2e61b2` | Filled actions with light text |
| Success | `#66d9a3` | Selected or completed states |
| Warning | `#ffc766` | Pending states |
| Danger | `#ffb4b4` | Errors |
| Border | `#404f66` | Card boundaries |
| Control border | `#697d99` | Stronger form-control boundaries |

Success and warning colors/surfaces come from the dashboard reference. Danger,
hover, and form-control border tokens extend that palette for interaction and
readability. Inter is bundled locally through `@fontsource/inter` at weights
400, 600, and 700; development and production builds need no remote font fetch.

Cards use a 14px radius, the inset navigation uses 19px, and primary buttons
use a pill shape. Page titles use 25px bold type. Use Tailwind's standard 4px
spacing scale for content, with the reference's 18px mobile page inset.
Controls have at least 48px height and 16px input text. The mobile dock has
safe-area spacing; `.app-content` reserves space so it does not cover content.
Content expands up to 768px on desktop; the compact dock is capped at 448px.

## Components

Import from the individual files under `src/components/ui/`.

| Component | Main API / behavior |
| --- | --- |
| `Button`, `ButtonLink` | `variant="primary\|outline\|ghost"`; Button accepts `loading`, disables during loading, defaults to `type="button"` |
| `Card` | Optional `elevated`, native div attributes, `className` |
| `Input` | Required `id`, `label`; optional `hint`, `error`; native input attributes |
| `Select` | Same field API with native `<option>` children; native mobile picker |
| `Textarea` | Same field API for multiline text; native textarea attributes |
| `Modal` | Controlled `open`, `onClose`, `title`, optional `description`, children |
| `Badge` | `tone="neutral\|accent\|success\|warning\|danger"`; include text so status is not color alone |
| `Avatar` | `name`, `size="sm\|md\|lg"`; accessible initials, no image service dependency |
| `BottomNavigation` | Optional `items` containing `href`, `label`, `icon`; pathname-based `aria-current` |
| `PageHeader` | `title`, optional `description`, `backHref`, `action` |
| `EmptyState` | `title`, `description`, optional `icon`, `action` |
| `LoadingState` | Optional `label`; live status with reduced-motion support |
| `ErrorMessage` | Message children, optional recovery `action`; alert semantics |

Use `ButtonLink` for navigation and `Button` for actions. Pass `type="submit"`
explicitly in forms. Inputs and selects compose their hint/error descriptions
with any supplied `aria-describedby`; labels remain visible.

`Modal` uses native `<dialog>.showModal()` for the top layer, background
inertness and focus restoration, with explicit Tab/Shift+Tab wrapping to keep
keyboard focus in its controls. Escape, the close button,
and backdrop clicks dismiss it. Keep it mounted and control `open` from the
parent; `onClose` should set that state to false. The first focusable control
is the close button. Body scrolling is locked while open. Use one modal at a time.

The authenticated layout currently links to **Trips** and **Account**. The
Figma Flights/Group destinations can be supplied through `items` when those
routes exist. Branding remains in `src/config/site.ts` and `Brand`.
The [flight components](flights.md) show available country flags beside airport
codes and use 24-hour local airport times. `AirlineDisplay` provides consistent
airline-name text; official airline logos are deferred.

## Verification

```powershell
yarn test:ui
yarn test:auth
yarn lint
yarn typecheck
yarn build
```

UI checks require the Playwright Chromium installation (`yarn playwright install
chromium`), and can reuse a running development server. They need no Docker or
Supabase services. They exercise mobile/desktop controls, disabled and invalid
states, dialog focus containment, Escape/backdrop dismissal, focus restoration,
navigation state, responsive overflow, auth links, and anonymous route protection.
Screenshots and failure traces are written under ignored `test-results/`.

The database-backed signup/session tests remain available separately with
`yarn test:e2e` and local Supabase, as documented in `authentication.md`.
