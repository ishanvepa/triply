# Trip dashboard (Phase 2, Step 2.4)

`/trips/[tripId]` is the group's planning dashboard, based on
[Figma Frame 02](https://www.figma.com/design/2HViNFR9Qmm1jSBDBcQ6F8?node-id=1-15).
It uses the shared dark palette, elevated progress panel, and colored route
cards, with responsive flow layout for dates, longer routes, and group controls.
The existing Trips/Account dock remains in use.

## Summary and travel legs

The summary displays the real trip name, calendar dates, optional description,
date-window status, and member count. Destinations are the unique destination
airports in itinerary order. A small display catalog supplies city names and
country flags for known airports; other IATA codes display without guessed
metadata. The group count links to the member list. Organizers also have an
Invite friends shortcut to the existing invitation manager.

Travel legs are ordered by `position`, with ID as a stable tie-breaker. Each
card displays the route, travel date, proposal count, computed status, and
booking counts when a flight is selected. Statuses are derived from records:

| Status | Condition |
| --- | --- |
| Needs options | No selected flight and no proposals |
| Decision pending | Proposals exist, but no flight is selected |
| Flight selected | A selection exists without any booked/planning-to-book reports |
| Booking underway | A selection exists and at least one current member reports booked or planning to book |

`not_decided` and `not_joining` alone do not imply that booking is underway.
There is no separate status column or invented booking-complete status.

Every card links to `/trips/[tripId]/legs/[legId]`, a member-only proposal list.
It displays each existing option's airline, flight number,
price snapshot, and departure/arrival in the respective airport time zones
using 24-hour times. The chosen option is marked Selected flight. A missing
price differs from a zero price. No proposals produces an explicit empty state.

Travel-leg creation/editing/reordering is available in [Step 2.5](travel-legs.md).
Organizers add legs from the dashboard, move them using Up/Down, and open Edit leg
from a leg's proposal page. [Step 2.6](flights.md) adds manual proposal submission,
details, and booking links through the leg's **+ Propose option** action.
Voting, flight selection, and booking-report editing remain in their later
planned steps. The dashboard already reflects their database records.

## Progress definitions

- Planning: selected legs / total legs.
- Per selected leg, booking: booked current members / participating current members.
  Current members without reports are not booked; `not_joining` excludes a member
  from that leg's denominator.
- Trip booking: sum of booked traveler-leg pairs / sum of participating
  traveler-leg pairs, across selected legs only. The same traveler can contribute
  once per selected leg. Unselected legs remain visible in planning progress.

The summary explicitly labels bookings as self-reported. Only reports for the
leg's current selection and current members contribute. Zero-leg trips and
all-opt-out groups display useful zero states, never NaN or completed progress.
Accessible progress bars expose both numeric values and explanatory text.
Data refreshes on navigation/reload; realtime subscriptions are not introduced.

## Access and failure states

Pages verify the session and membership before loading planning records. Queries
use the request-scoped Supabase client, include explicit trip filters, and remain
subject to RLS. There is no service-role client, shared user-data cache, new
migration or database mutation for reading progress. [Travel-leg management](travel-legs.md)
adds the authenticated organizer-only mutations separately.

Missing/inaccessible trips and legs show the same Trip unavailable state. A leg
from another trip cannot be loaded by changing the URL. Signed-out users return
through login. Removed membership takes effect on the next request.

Loading streams a planning skeleton. Failure to read any planning table shows a
dedicated error with retry and a return link, rather than false empty cards or
zero progress. Existing invitation and member flows continue to work.

## Verification

```powershell
yarn test:dashboard
yarn test:auth
yarn test:trips
yarn test:invitations
yarn lint
yarn typecheck
yarn build
yarn auth:start
yarn test:e2e
```

Unit tests cover status precedence, opt-outs, missing reports, stale/unrelated
reports, zero denominators, itinerary ordering, destination deduplication, and
trip totals. Local integration tests cover all four statuses, member/organizer
views, proposal navigation, local times/prices, empty trips, booking updates,
trip/leg access boundaries, removed membership, loading, query failure/retry,
and mobile/desktop overflow and screenshots.

Integration tests use `.next-e2e` and `tsconfig.e2e.json` so they can run beside
the normal development server. The Playwright server receives only local
Supabase credentials in memory; `.env.local` is untouched. Fixtures are removed
afterward, and temporary local grants/locks are restored in `finally` blocks.
Stop the local services with `yarn supabase stop` when finished.

Step 2.4 verification: lint, type checking, production build, and all 15 unit
tests passed. The browser suite passed 13 checks, including all five dashboard
checks; one existing auth check timed out on a login request and passed on an
isolated rerun. Mobile and desktop dashboard screenshots were visually reviewed.
