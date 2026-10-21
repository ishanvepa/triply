# Trips Home (Phase 2, Step 2.1)

`/trips` displays the signed-in traveler's trips using Frame 01 of the
[Figma reference](https://www.figma.com/design/2HViNFR9Qmm1jSBDBcQ6F8?node-id=1-2).
It uses the existing dark tokens, rounded cards, outline action, and inset dock.
The shared app header and Trips/Account navigation from Step 1.5 remain in use.

## Data and access

`src/lib/trips/queries.ts` verifies the session with `requireUser`, then queries
with the request-scoped Supabase client and the user's credentials. The query
joins `trip_members`, filters by the verified user ID, and remains subject to RLS.
Both organizers and ordinary members see their trips. No service-role client,
new migration, cross-user cache, or hosted test data is involved.

The list is ordered by start date ascending, with ID as a stable tie-breaker.
Cards show the name, calendar date range including years, date-based status,
and a link to `/trips/[tripId]`. Database dates are formatted explicitly in UTC
so they never shift a day because of a browser or server timezone.

The schema has no trip-status column. Status is derived against today's UTC
calendar date: **Upcoming** before the start date, **In progress** from the start
through the end date inclusive, and **Past** afterward. These labels describe
the date window, not voting, flight selection, or booking completion.

## States and navigation

- Empty: “No trips yet. Create your first trip and start planning together.”
- Loading: a streamed loading status and card skeletons.
- Failed query: an error with a working retry action; failure never becomes an empty list.
- Populated: responsive trip cards with full-card keyboard-accessible links.
- Missing, invalid, or inaccessible trip: the same “Trip unavailable” page,
  without disclosing whether another group's trip exists.

The **New trip** button navigates to a protected `/trips/new` destination. The
creation form and save workflow remain Step 2.2. Opening a trip displays a
read-only overview with its real name, dates, status, and optional description;
the full planning dashboard remains Step 2.4. Both destinations include a return
link. Invitation acceptance remains Step 2.3.

## Verification

```powershell
yarn test:trips
yarn lint
yarn typecheck
yarn build
```

The date tests cover inclusive status boundaries, cross-year ranges, single-day
trips, and formatting under western/eastern timezones.

Integration checks use the existing local Supabase setup:

```powershell
yarn auth:start
yarn test:e2e
yarn supabase stop
```

Stop an existing development server before the integration run; its server uses
the same Next.js build directory. Tests create only local users/trips and remove
their fixtures afterward. They verify empty/populated lists, organizer and member
visibility, exclusion of other groups, removed membership, date labels, long names,
navigation, protected URLs, streamed loading, failure/retry, and mobile/desktop
layout. Loading is tested under a temporary database lock. Query failure is tested
by temporarily revoking and restoring a local table grant inside `try/finally`.
No hosted configuration or schema is changed.
