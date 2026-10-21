# Database foundation (Phase 1, Steps 1.2–1.3)

The schema lives in `supabase/migrations/20261019000000_initial_schema.sql`.
Apply this migration through the CLI rather than editing tables independently
in the dashboard. The application uses the publishable key with the signed-in
user's JWT; there is no service-role client in the application.

Verified locally on October 19, 2026: a fresh database rebuild, 82 pgTAP
assertions, four concurrent-write scenarios, schema lint, generated types,
TypeScript, ESLint, and the production build.

The initial migration was applied to the configured hosted Supabase project on
October 19, 2026, with migration history recorded. All eight application tables
have RLS enabled. A hosted check passed 28 assertions covering table security,
profile and organizer creation, invitation acceptance, flight proposals,
voting, selection, and booking ownership. Its transaction was rolled back and
verified to leave no test data. Database types were regenerated from the hosted
schema. Database connection credentials remain only in ignored `.env.local`.

## Tables and relationships

| Table | Identity and purpose |
| --- | --- |
| `profiles` | One profile per `auth.users` ID; no public email field |
| `trips` | Creator, name, description, and inclusive date range |
| `trip_members` | Unique `(trip_id, user_id)` with `organizer` or `member` role |
| `trip_invitations` | Expiring/revocable invitations; stores only a SHA-256 token hash |
| `trip_legs` | Ordered airport-to-airport segments, optionally referencing a selected proposal |
| `flight_proposals` | Manually entered flights attached to one trip and leg |
| `flight_votes` | Unique `(trip_leg_id, user_id)`; each member has one current vote per leg |
| `flight_bookings` | Unique `(trip_leg_id, user_id)`; self-reported status for the selected flight |

Composite foreign keys prevent proposals, selections, votes, and bookings from
crossing trip or leg boundaries. Votes and bookings also reference current
membership. Deleting a membership removes its votes and bookings; its flight
proposals remain available to the group. Deleting a trip cascades its planning
records. Deleting an account that still owns a trip is restricted.

Creating a trip automatically creates organizer membership in the same
transaction. New Auth users receive profiles; existing users are backfilled by
the migration. The creator remains organizer in this MVP: clients cannot
reassign ownership, promote themselves, or remove organizer membership.

Leg membership is not mandatory participation. A booking row is created only
when a traveler reports a status, and `not_joining` is an explicit option. No
table assumes that every traveler will take every leg. Traveler-specific legs
can be added later without changing the identity of users or memberships.

## Times, prices, and decisions

Flight departures and arrivals use `timestamptz`, plus separate IANA airport
time-zone fields. Validate local departure dates against the leg date and
require arrival after departure. Display those instants in their respective
airport time zones using 24-hour formatting when flight UI is implemented.
Airport country flags will come from airport metadata, not these timestamps.

Prices are optional nonnegative snapshots with a three-letter currency code;
the default currency is USD. Booking links accept HTTP(S) URLs. No flight search,
price refresh, or booking verification is implemented.

An organizer sets `trip_legs.selected_proposal_id`. Selection closes proposal
editing and voting. Booking records must reference that exact selection. Before
changing a selected flight, travelers must remove any existing booking status
records so a purchase report cannot silently transfer to another flight.
Remove proposals before changing a leg's route or travel date. Reordering is
supported by a deferrable unique `(trip_id, position)` constraint. The Step 2.5
`reorder_trip_legs` RPC defers it within its transaction, locks the trip and legs,
and rejects stale displayed orders. `create_trip_leg` uses the same trip lock
to append without racing another app append or reorder. See [travel legs](travel-legs.md).

Proposal, vote, and booking writes lock their travel-leg row. That serializes
them with selection so a vote cannot pass a stale "voting open" check while an
organizer closes the decision in another transaction.

## Authorization

Every application table has RLS enabled and explicit grants. Anonymous clients
have no table access. Authenticated users can:

- Read their own profile and profiles of current tripmates.
- Read planning data only in their own trips.
- Create trips; edit/delete trips and legs only as organizer.
- Propose flights as members; edit only their own proposals while voting is open.
- Vote, change votes, or withdraw only their own vote before selection.
- Create/update/delete only their own booking status after selection.
- Leave as an ordinary member, or remove ordinary members as organizer.

The organizer can remove inappropriate proposals, but cannot edit another
member's proposal details, votes, or booking reports. Column grants prevent
clients from changing IDs, authorship, roles, or audit timestamps. Timestamps
are maintained by triggers.

Membership-check functions run with a fixed empty `search_path` in the
unexposed `private` schema to avoid recursive membership policies. Exposed RPCs
are security-invoker wrappers around narrowly scoped private functions. Do not
add `private` to Supabase's exposed API schemas.

### Invitation RPCs

`create_trip_invitation({ p_trip_id, p_expires_at? })` requires organizer access.
It returns `invitation_id`, the raw `token` (once), and `expires_at`. The default
expiry is seven days. Share the raw token only in the invitation link; never
log it. Database storage contains its hash only. Organizers revoke an invitation
by setting `trip_invitations.revoked_at`.

`accept_trip_invitation({ p_token })` requires a signed-in user, validates the
hash, expiry, and revocation, and inserts an ordinary membership. Acceptance is
transactional and idempotent. Direct membership inserts and role changes are
not granted to client roles. The [Step 2.3 invitation flow](invitations.md) uses
these database primitives for link creation, revocation, and explicit joining.

Use separate insert/update calls for votes and bookings. Ownership and scope
columns are deliberately not updateable, so a generic upsert that updates every
submitted column is not part of this API.

## Local development and verification

Docker Desktop must be running with Linux containers:

```powershell
yarn db:start
yarn db:reset
yarn db:test
yarn db:test:concurrency
yarn db:lint
yarn db:types
yarn lint
yarn typecheck
yarn build
```

`db:start` starts the database only. `db:reset` rebuilds only the **local**
database from migrations; never use a reset command against the hosted project.
The pgTAP suite uses a transaction and rolls it back. It tests separate users,
both allowed and forbidden operations, invitation validation, constraints,
selection, and membership/trip deletion. Test identities are never seeded into
the hosted project.

`db:test:concurrency` uses separate connections to the local database on port
54322. It verifies that voting and booking writes serialize with selection,
then removes its isolated test fixtures. It also verifies concurrent travel-leg
appends and stale reorder rejection. It never reads hosted credentials.

`db:types` generates `src/types/database.types.ts` from the migrated local
database. It writes atomically and keeps the old file if generation fails.
Both the browser and per-request server clients use these generated types.
The session-refresh proxy preserves refreshed cookies and the SSR library's
cache headers. Login, signup, verified account access, and protected-route
redirects are documented in [authentication setup](authentication.md).

## Apply to the hosted project

Public API keys cannot perform schema migrations. Choose one method:

1. Add a direct or **session-pooler** PostgreSQL connection URI as
   `SUPABASE_DB_URL` in `.env.local`. Percent-encode special characters in the
   database password. Then run:

   ```powershell
   yarn db:push --dry-run
   yarn db:push
   yarn db:types --remote
   ```

2. Authenticate and link the CLI, then use the same commands:

   ```powershell
   yarn supabase login
   yarn supabase link --project-ref YOUR_PROJECT_REF
   yarn db:push --dry-run
   yarn db:push
   yarn db:types --remote
   ```

3. If CLI/database access is unavailable, run the checked-in migration in the
   project's Supabase SQL Editor. Apply it once, without the tests. Prefer the
   CLI workflow for tracked migration history; if applied manually, reconcile
   that history with `supabase migration repair` before subsequent CLI pushes.

Check the target project and dry-run result before applying migrations. The
wrapper also checks that hosted connection credentials match the public project
URL and rejects transaction-pooler connections for this workflow. The
initial migration creates new tables and fails on naming conflicts; it does not
drop or replace existing application tables. Keep all database credentials in
ignored environment files. Application code never reads `SUPABASE_DB_URL`.

## Sources

- [Supabase RLS and grants](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Migration workflow](https://supabase.com/docs/guides/local-development/database-migrations)
- [Generated database types](https://supabase.com/docs/guides/api/rest/generating-types)
- [SSR clients and session refresh](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
