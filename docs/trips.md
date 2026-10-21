# Trips Home and creation (Phase 2, Steps 2.1–2.2)

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

The **New trip** button navigates to the protected `/trips/new` creation form.
Opening a trip displays a
read-only overview with its real name, dates, status, and optional description;
the full planning dashboard remains Step 2.4. Both destinations include a return
link. Invitation acceptance remains Step 2.3.

## Creating a trip

The form includes a required trip name, start date, end date, and optional
description. It uses the shared Input, Textarea, Card, and Button components.
Cancel returns to Trips Home without saving. The submit button and fields are
disabled while saving. Validation errors are associated with their fields,
announced with a summary, and move focus to the first invalid field. A failed
database request shows a generic retry message and retains the entered values.

`src/app/(app)/trips/new/actions.ts` independently verifies the session before
validating input. Names are trimmed and limited to 1–120 characters; optional
descriptions are trimmed and limited to 5,000 characters, with blank descriptions
stored as NULL. Both dates must be real ISO calendar dates in years 0001–9999,
and the end date cannot precede the start date. Single-day and historical trips
are allowed. Date strings reach Postgres unchanged, without timezone conversion.

Only those four fields are inserted using the request-scoped Supabase client.
Submitted creator IDs, member IDs, and roles are ignored. The database generates
the trip ID, defaults `created_by` to `auth.uid()`, enforces RLS, and adds the
creator as organizer through the existing trigger in the same transaction. No
additional membership request, service-role client, or migration is needed.
After insertion, the action revalidates `/trips` and redirects to the new trip's
read-only overview. The full dashboard remains Step 2.4.

If the session expires while the form is open, the action redirects to login
with `/trips/new` as the return destination. Proxy navigation checks defer
Server Action POST redirects to the action's own verified-session guard so the
response uses Next's action protocol. Ordinary protected POSTs redirect with
303; protected GETs retain their 307 redirect. This does not grant access based
on a request header; pages and protected actions verify the user themselves.

## Verification

```powershell
yarn test:trips
yarn lint
yarn typecheck
yarn build
```

The unit tests cover name/description bounds, whitespace, non-text names,
forged ownership fields, leap days, invalid calendar dates, reversed ranges,
single-day trips, inclusive status boundaries, cross-year ranges, and formatting
under western/eastern timezones.

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

Creation checks exercise server validation with browser validation bypassed,
description persistence, automatic organizer membership, ignored ownership
fields, redirect/list refresh, reload persistence, optional descriptions,
cancel, failed-insert recovery, pending controls, and signed-out submissions.
Failed inserts are tested with a temporary local column-grant revocation,
restored in `finally`. Mobile and desktop form screenshots are captured.
