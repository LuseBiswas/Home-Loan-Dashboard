# Home Loan Compass

Home Loan Compass is a private, responsive dashboard for understanding and managing a floating-rate home loan. It turns lender documents and account data into a clearer view of outstanding principal, repayment dates, rate movements, payment progress, and contractual interest-rate checks.

The project is designed to answer a practical question: **is the interest rate currently applied by the lender consistent with the benchmark and spread written into the loan contract?**

## Goals

- Keep personal loan records in a private, user-owned workspace.
- Replace spreadsheet-style tracking with a clean visual dashboard.
- Preserve historical schedules and rate changes instead of overwriting them.
- Compare the lender-applied rate with the contractual benchmark formula.
- Monitor official RBI repo-rate and PNB Housing PNBRRR sources.
- Provide an evidence-based rate-review summary for discussing discrepancies with the lender.

## Features

- Email and password authentication through Supabase Auth.
- Row Level Security so users can access only their own loan records.
- Guided first-loan setup with no embedded personal or financial defaults.
- Database-backed loan overview, repayment schedule, installments, payments, and rate history.
- Dynamic outstanding-balance projection.
- Automatic official-rate check when the dashboard opens, throttled to once every six hours per loan.
- Contract calculation: `expected rate = lender benchmark + contractual spread`.
- Match, review, and pending states with basis-point differences.
- Historical rate snapshots saved only when repo, benchmark, or applied rate changes.
- Manual **Check now** action and copyable lender-review summary.
- Private Supabase Storage policies for loan documents.
- Reusable loading screen and rate-monitor components.

## Important rate distinction

The RBI policy repo rate is an external market signal. It is not automatically the contractual benchmark for every floating-rate home loan.

For a PNBRRR-linked loan, the application evaluates:

```text
Expected loan rate = Current PNBRRR + Contractual spread
Difference         = Bank-applied rate - Expected loan rate
```

Repo movements are tracked separately to show whether the lender benchmark has moved in the same direction. A repo-rate change alone does not prove that a lender has incorrectly priced an account.

## Technology

- Next.js 16 and React 19
- TypeScript
- Tailwind CSS 4
- shadcn-style UI components
- Recharts
- Supabase Auth, Postgres, Row Level Security, and Storage

## Architecture

```text
Browser
  -> Supabase Auth session
  -> Next.js dashboard
      -> Supabase Postgres through user-scoped RLS
      -> /api/rates/refresh
          -> official RBI rate page
          -> official PNB Housing rate page
          -> rate_events history
```

The rate-refresh API requires the signed-in user's access token. It uses the public Supabase key with that user's authorization context; it does not use or expose a service-role key.

## Database model

| Table | Purpose |
| --- | --- |
| `loans` | Core loan terms and current lender-applied rate |
| `schedule_versions` | Original and revised repayment schedules |
| `installments` | Scheduled installment dates and amounts |
| `payments` | Payments actually recorded by the user |
| `rate_events` | Repo, lender benchmark, expected rate, applied rate, and verification history |
| `documents` | Private document metadata; file bytes live in Supabase Storage |

Authentication users are managed by Supabase in `auth.users`.

## Local setup

### Requirements

- Node.js `22.13.0` or newer
- npm
- A Supabase project

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database

Open the Supabase SQL Editor and run each migration, in order:

```text
supabase/migrations/0001_initial_schema.sql
supabase/migrations/0002_prepayments.sql
```

This creates the database tables, indexes, ownership policies, update trigger, and private `loan-documents` Storage bucket.

### 3. Configure environment variables

Copy the example file:

```bash
cp .env.example .env.local
```

Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Both values are available from the Supabase project's **Connect** dialog or **Project Settings -> API Keys**.

Never add a service-role or secret key to a `NEXT_PUBLIC_` variable. `.env.local` is ignored by Git.

### 4. Configure authentication

In Supabase, enable the Email provider under **Authentication -> Sign In / Providers**. For production, keep email confirmation enabled and configure custom SMTP. During local-only testing, confirmation can be disabled temporarily.

### 5. Start development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available scripts

```bash
npm run dev      # Start the Next.js development server
npm run build    # Create a production build using webpack
npm start        # Start the production server
npm run lint     # Run ESLint
```

## Project structure

```text
app/
  api/rates/refresh/route.ts   Authenticated official-rate fetch and persistence
  home-loan-app.tsx            Authentication and application orchestration
  loan-dashboard.tsx           Main dashboard
  loan-setup.tsx               First-loan setup form
components/
  loading-screen.tsx           Shared full-page loading component
  rate-watch-strip.tsx         Official-rate contract comparison strip
lib/
  loan-service.ts              Supabase loan data access
  rate-monitor.ts              Browser client for the rate-refresh API
  supabase/client.ts           Public Supabase browser client
supabase/migrations/
  0001_initial_schema.sql      Reproducible schema and security policies
```

## Security

- Financial records are protected by Supabase Row Level Security.
- The browser receives only the publishable Supabase key.
- Private documents are stored under a user-specific Storage path.
- Full account identifiers should not be entered; use a masked reference.
- Official source pages are fetched server-side so browser CORS does not weaken the design.

## Current limitations

- Automatic rate checking runs when the dashboard is opened and can be triggered manually. Out-of-app email or push notifications require deployment, a scheduled job, and a transactional email provider.
- Official page layouts can change. Parsing failures are displayed without replacing previously verified data.
- The lender-applied account rate must come from the user's account, statement, or rate-revision notice; a public advertised rate is not a substitute.
- Schedule, payment, document, and simulator navigation controls are present but their complete management screens are still under development.

## Disclaimer

This application is an informational personal-finance tracker. It does not provide legal, financial, or lending advice. Always verify rates and account changes against official lender records before taking action.
