# Selected flights (Step 3.1)

The member-only route `/trips/[tripId]/legs/[legId]/selected` shows the flight
chosen by the organizer. It follows Figma Frame 08 (`1:105`), using the existing
elevated ticket card, palette, airline-name fallback, schedule, and buttons.
The required local times and dates extend the wireframe's ticket content.

## Navigation and ticket

Confirming a group decision opens this screen. A dashboard travel-leg card opens
it whenever a selection exists; undecided legs continue to open Flight options.
Options and decision results also provide **View selected flight** links.
The selected screen links back to the dashboard, all proposals, and the group
decision, so the original alternatives remain accessible.

The ticket displays airline, optional flight number, origin and destination,
local departure and arrival times, dates, and each airport's time zone. The
price is the original proposed amount, with explicit currency and **per person**.
Missing prices show **Not provided**; a zero price remains visible. Selection
is labeled as the group's choice with voting closed.

## External booking

**Book on airline site ↗** opens the saved HTTP(S) booking URL in a new tab with
`noopener noreferrer`. The destination hostname is visible before opening it.
The same URL validator used by proposal details rejects malformed URLs,
credential-bearing links, whitespace/control characters, and unsafe schemes.
Absent or rejected links show a clear fallback instead of a clickable action.

The screen explains that the price and seat availability are not guaranteed and
that the URL may open a general search or booking page. Each traveler books
individually. Opening the link makes no booking record or status change, and
triply does not claim to verify a purchase.

## Group progress

The page reads existing booking reports for the selected proposal, scoped by
trip and leg. It reuses the dashboard's tested progress calculation: booked
current members divided by current members who are participating. Members
marked **Not joining** are excluded and their count remains visible. Missing
reports, **Not decided**, and **Planning to book** do not count as booked.

The screen shows booked/participating counts, an accessible progress indicator,
and the number still needing to book. If everyone opts out, it shows **No
participating travelers** with zero progress. It labels the reports as
self-reported and unverified. Reads on reload or navigation reflect stored
changes; realtime updates and the member status list remain Step 3.3. Status
editing remains Step 3.2.

## Access and recovery

Membership is checked before reading the selected proposal, and all queries use
the authenticated request-scoped client under RLS. Proposal and booking reads
are scoped to the current trip, leg, and selected ID. Invalid IDs, mismatched
legs, outsiders, and removed members receive the existing unavailable state.
Signed-out visitors return through login to the same selected-flight URL.

A valid leg without a selection shows **No flight selected** with a link to
the group decision. Loading has a selected-flight skeleton. Failed reads show
**Selected flight unavailable** with **Try again**, rather than implying zero
bookings or a missing choice. There are no new migrations or hosted data writes.

## Verification

```powershell
yarn test:dashboard
yarn lint
yarn typecheck
yarn build
yarn auth:start
yarn test:e2e tests/e2e/selected-flight.spec.ts tests/e2e/voting.spec.ts tests/e2e/dashboard.spec.ts
yarn supabase stop
```

Selected-flight browser checks cover the shared ticket, selection navigation,
safe new-tab booking, no automatic booking write, current group counts,
opt-outs, missing/unsafe links, missing prices, narrow and desktop layouts,
no selection, membership/leg boundaries, login return, failed-read recovery,
and loading. Booking destinations are intercepted local fixtures; tests do not
visit a real airline site. Fixtures and temporary grants/locks are cleaned up.

Verified: all 14 targeted browser checks (four selected-flight, five voting,
five dashboard) and all five dashboard/progress unit tests passed. Lint, type
checking, and the production build passed. Mobile and desktop screenshots were
visually reviewed. The existing Trips/Account dock and platform-dependent flag
display remain as established by the app, rather than the wireframe's navigation.
