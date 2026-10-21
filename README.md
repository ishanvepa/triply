# triply

A mobile-first collaborative flight planner. The current implementation includes
the Next.js foundation, the **Step 1.3** database schema and RLS, and **Step 1.4**
authentication and the **Step 1.5** design system from [the MVP plan](docs/mvp-plan.md).
**Step 2.1** adds the membership-scoped Trips Home screen, date/status cards,
loading and error states, and protected navigation destinations.
**Step 2.2** adds validated trip creation with automatic organizer membership
and navigation to the new trip.
**Step 2.3** adds invitation links, copy/share and revocation, explicit joining,
and group member lists.
**Step 2.4** adds the trip dashboard, ordered travel-leg cards, computed planning
and booking progress, and member-only navigation to existing flight proposals.
**Step 2.5** adds organizer-only travel-leg creation, editing, and atomic ordering,
with proposal locks and stale-update protection.
**Step 2.6** adds manual flight proposals, shared options and details, airport-local
schedules, optional prices/booking links/notes, and airline-name display.
**Step 2.7** adds changeable member votes, support percentages and ties, and
organizer-confirmed flight selection that closes voting for the leg.
See [database setup and verification](docs/database.md) for migration status and
the local/hosted workflows. The initial migration has been applied and verified
on the configured hosted Supabase project.
See [authentication setup and verification](docs/authentication.md) for signup,
confirmation emails, sessions, account settings, and optional Google sign-in.
See [the design system](docs/design-system.md) for tokens, reusable components,
and the development preview at `/design-system`.
See [Trips Home](docs/trips.md) for its behavior, scope, and integration tests.
See [trip invitations](docs/invitations.md) for link management and the join flow.
See [the trip dashboard](docs/dashboard.md) for statuses, progress definitions,
scope, and integration tests.
See [travel legs](docs/travel-legs.md) for forms, ordering, and migration details.
See [flight proposals](docs/flights.md) for manual entry, schedules, and verification.
See [group decisions](docs/voting.md) for voting rules, confirmation, and verification.

## Local development

Use Node.js 22 LTS or newer and Yarn Classic 1.22.22, pinned in `package.json`.
Development was verified with Node.js 22.16.0. If Yarn is not already installed,
use Corepack to activate the project's pinned version:

```powershell
corepack enable
```

Install dependencies and start the development server:

```powershell
yarn install --frozen-lockfile
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
yarn dev
```

Open [localhost:3000](http://localhost:3000). Set the public Supabase values in
`.env.local` before using login/signup. Set `NEXT_PUBLIC_SITE_URL` to your app
origin (defaults to localhost:3000). `.env.local` is ignored by Git. Never put a secret or
service-role key in a `NEXT_PUBLIC_` variable.

Docker is only needed for local Supabase integration tests. Regular development
with your hosted Supabase project does not require Docker.

## Verification

```powershell
yarn lint
yarn typecheck
yarn build
yarn test:auth
yarn test:trips
yarn test:invitations
yarn test:dashboard
yarn test:travel-legs
yarn test:flights
yarn test:voting
yarn test:ui
```

Use `yarn start` after a successful build to serve the production application.
Commit `yarn.lock` when dependencies change. Use `yarn add` and `yarn add --dev`
to manage dependencies.

At initialization (October 18, 2026), the production dependency audit reported no
vulnerabilities. The full audit reports five high-severity entries from the
ESLint tooling's transitive `braces` dependency. Its latest release, 3.0.3, is
affected; no patched release is available. Revisit this when updating tooling.

## Structure

```text
docs/mvp-plan.md       Project requirements and incremental development plan
public/               Static assets
src/app/              App Router pages, root layout, and global CSS
src/config/site.ts    Working name and shared page metadata
src/lib/supabase/     Typed browser/server clients and session refresh
src/lib/auth/         Verified sessions, auth callbacks, validation, and redirects
src/types/            Generated database types
supabase/             CLI config, migrations, and database integration tests
tests/                Auth validation and local Supabase browser tests
```

The scaffold uses Next.js App Router, strict TypeScript, Tailwind CSS, ESLint,
Yarn, and the `@/*` import alias for `src/*`. Inter is bundled locally, keeping
builds independent of external font downloads.

## Design direction and next steps

[Figma reference](https://www.figma.com/design/2HViNFR9Qmm1jSBDBcQ6F8).
The app is dark by default and adapts to mobile screens. The reusable design
system follows the Figma palette, typography, cards, actions, and compact dock.
Flight screens show available country flags beside airport codes and use
24-hour local airport times. Airline names provide a consistent text fallback.

Update `src/config/site.ts` to change the working name and shared description.
The next application step is **3.1: Implement the Selected Flight screen**. `/trips` lists
the user's trips, `/trips/new` creates a trip, and `/trips/[tripId]` provides a
dashboard with trip summary, travel legs, planning/booking progress, members,
and invitation management. Travel-leg cards open the existing proposals at
`/trips/[tripId]/legs/[legId]`. `/invite/[token]` lets authenticated travelers
explicitly join a trip.
Organizers add legs at `/trips/[tripId]/legs/new`, edit them from their proposal
page, and reorder them on the dashboard.
Members propose flights from a leg's **+ Propose option** action, enter details
at `.../proposals/new/manual`, and open shared details at `.../proposals/[proposalId]`.
The **Group decision** action opens `.../decision` for voting, results, and
organizer confirmation. Members can refresh results to see other travelers' changes.
