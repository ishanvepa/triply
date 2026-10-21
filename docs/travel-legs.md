# Travel legs (Phase 2, Step 2.5)

Organizers build the itinerary from `/trips/[tripId]` using **+ Add travel leg**.
Each leg has an origin airport, destination airport, and local departure date.
Creating a leg appends it to the itinerary and returns to the dashboard. The
dashboard derives its destinations, statuses, and planning totals from these
records. Each route card still links to that leg's flight proposals.

## Creating and editing

`/trips/[tripId]/legs/new` uses the shared form components. Known airport codes
have native autocomplete suggestions from the small airport catalog. Any
three-letter ASCII airport code is accepted; the catalog is display metadata,
not a claim that codes have been checked against a live airport registry.
The server trims and uppercases codes, rejects identical origin/destination
codes, and validates real calendar dates in years 0001–9999. Dates are stored
unchanged as Postgres DATE values. Manual itinerary order is independent of
date order, and no additional trip-date restriction is imposed.

Organizers open a route card and select **Edit leg** to change its details at
`/trips/[tripId]/legs/[legId]/edit`. Successful saves return to the proposal
page and refresh the dashboard's destinations and dates. Updates include the
original `updated_at` value, so a stale form cannot silently overwrite a newer
edit. A conflict asks the organizer to reload and preserves the entered values.

Once a leg has proposals, its route and date are locked. The edit page explains
why and displays disabled fields. The database trigger independently rejects
changes if proposals arrive after the form opens. Reordering remains available
and keeps proposals, votes, selections, and booking reports attached to the
same leg ID. Step 2.5 does not add leg/proposal deletion or silently discard
existing planning records.

Forms show field-level validation, focus the first invalid field, retain values
after failed writes, and disable controls while saving. Cancel leaves the data
unchanged. Signed-out submissions return through login with the form URL intact.

## Ordering and database access

The dashboard shows **Up** and **Down** buttons for organizers when there are
multiple legs. Endpoint moves are disabled. A move saves immediately, announces
the result, and focuses the moved route card. Controls are disabled during a
move. Members can view the itinerary and proposals without management controls.

Migration `20261020000000_travel_leg_ordering.sql` adds two authenticated RPCs:

- `create_trip_leg` checks organizer access, locks the trip row, and assigns the
  next available position before inserting. Concurrent appends receive distinct
  positions; clients do not supply a position or selected flight through the app.
- `reorder_trip_legs` checks organizer access, locks the trip and its legs, and
  compares the displayed ID order with the current order. It requires each leg
  from that trip exactly once, defers the position uniqueness constraint, and
  updates positions atomically. Missing, duplicate, null, or foreign-trip IDs
  are rejected. Stale snapshots return SQLSTATE `40001`; the action refreshes
  the dashboard and asks the organizer to review the new order before retrying.

The functions use security-invoker execution and an empty search path. Existing
RLS and column grants still apply. Details use a normal scoped table update;
no service-role client or database credential enters application code. All
actions verify the session and organizer role independently. Form ownership,
scope, position, selection, and audit fields are ignored. New/edit pages verify
membership, organizer access, and trip/leg boundaries before showing data.

## Verification

```powershell
yarn auth:start
yarn supabase migration up --local
yarn db:types
yarn test:travel-legs
yarn db:test
yarn db:test:concurrency
yarn db:lint
yarn test:e2e
yarn lint
yarn typecheck
yarn build
```

Unit checks cover normalization, malformed and identical codes, calendar dates,
forged extra fields, and up/down boundaries. Rollback-only database tests cover
append/reorder permissions, exact ID sets, atomic swaps, and stale orders.
Separate-connection tests verify simultaneous appends, competing reorders, and
an append invalidating an older reorder snapshot.

Local browser checks cover multi-leg creation, persistent ordering, edits,
proposal navigation and route locks, stale edits and orders, failure recovery,
pending controls, role changes before submission, cancellation, signed-out
submissions, and mobile/desktop screenshots. Fixtures are removed afterward;
temporary grants and locks are restored. Tests never use hosted credentials.

Deploy the migration with `yarn db:push --dry-run` followed by `yarn db:push`
after confirming the configured project, as described in [database.md](database.md).
Flight proposal submission is available in [Step 2.6](flights.md).

Step 2.5 verification: all 19 unit tests, 106 database assertions, the concurrency
suite, and all 19 browser integration tests passed, along with database lint,
ESLint, type checking, and the production build. Mobile/desktop form and ordered
itinerary screenshots were visually reviewed. The migration was applied to the
configured hosted Supabase project; a subsequent dry run reported no pending
migrations. Hosted verification checked function permissions without creating
test accounts or itinerary records.
