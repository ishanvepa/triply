# triply

A mobile-first collaborative flight planner. The current implementation covers
**Phase 1, Step 1.1** of [the MVP plan](docs/mvp-plan.md): project initialization.

## Local development

Use Node.js 22 LTS or newer and npm. Development was verified with Node.js 22.16.0
and npm 10.8.2.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000). The starter page works without any
Supabase credentials. The empty values in `.env.example` reserve the public
configuration for Step 1.2; `.env.local` is ignored by Git. Never put a secret or
service-role key in a `NEXT_PUBLIC_` variable.

## Verification

```powershell
npm run lint
npm run typecheck
npm run build
```

Use `npm start` after a successful build to serve the production application.

At initialization (October 18, 2026), `npm audit --omit=dev` reports no
vulnerabilities. The full audit reports five high-severity entries from the
ESLint tooling's transitive `braces` dependency. Its latest release, 3.0.3, is
affected; no patched release is available. Revisit this when updating tooling.

## Structure

```text
docs/mvp-plan.md       Project requirements and incremental development plan
public/               Static assets
src/app/              App Router pages, root layout, and global CSS
src/config/site.ts    Working name and shared page metadata
```

The scaffold uses Next.js App Router, strict TypeScript, Tailwind CSS, ESLint,
npm, and the `@/*` import alias for `src/*`. System fonts keep the initial build
independent of external font downloads.

## Design direction and next steps

[Figma reference](https://www.figma.com/design/2HViNFR9Qmm1jSBDBcQ6F8).
The starter is dark by default and adapts to mobile screens. Detailed Figma
implementation and the reusable design system are reserved for Step 1.5.
When flight screens are implemented, show country flags beside airport codes
and use 24-hour local airport times. Airline logos can wait.

Update `src/config/site.ts` to change the working name and shared description.
The next development step is **1.2: Configure Supabase**. Authentication, database
schema, trip workflows, and flight features are deferred to their respective
steps in the plan.
