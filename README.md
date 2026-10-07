# Mó real-estate OS

Mó is a Next.js App Router application backed by Supabase. Phases 1–6 connect the transaction workflow and customer portals, then add agency onboarding, team administration, contacts, stable property routes, and private property imagery.

## Requirements

- Node.js 20.19+ or 22.13+
- A Supabase project, or the Supabase CLI plus Docker for local development
- npm

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

Older Supabase projects can use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of the publishable key. Both are browser-safe public keys whose access is constrained by RLS.

Never put `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_*` variable or import it into application browser code. Phase 6 uses it only in a server-only team invitation action after the signed-in caller has been verified as an organization admin. Normal data access still uses the user's session and RLS.

## Install and run

```bash
npm install
npm run dev
```

Internal routes use `/login`. Seller and buyer routes use the customer-facing `/customer/login` screen and require an active transaction-scoped portal grant.

## Database setup

The migrations currently implemented are:

```text
supabase/migrations/20261003000100_phase1_foundation.sql
supabase/migrations/20261003000200_phase2_viewings.sql
supabase/migrations/20261003000300_phase3_offers.sql
supabase/migrations/20261004000100_phase4_customer_portal_access.sql
supabase/migrations/20261004000200_customer_portal_destinations.sql
supabase/migrations/20261004000300_phase5_tasks_documents.sql
supabase/migrations/20261005000100_customer_offer_list.sql
supabase/migrations/20261005000200_storage_document_policy_hardening.sql
supabase/migrations/20261007000100_phase6_agency_readiness.sql
```

Apply migrations through the Supabase CLI rather than making schema changes manually in the dashboard:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

For local Supabase, initialize/start the project as appropriate and use `supabase db reset` to apply migrations. RLS is enabled on every Phase 1 application table. Authenticated users receive only tenant-scoped reads; sensitive writes go through guarded RPCs.

## Create the development users and demo data

The seed never creates an Auth password and contains no secret.

1. Create these Auth users in local Studio or a hosted development project, each with a development-only password:
   - `sara@demo.is` — internal agent
   - `anna@demo.is` — seller
   - `jon@demo.is` — buyer
2. Confirm the users if email confirmation is enabled. Do not put passwords in migrations or `seed.sql`. The Auth trigger creates profiles; the seed assigns the correct display names, Sara's organization membership, and Anna/Jón's explicit transaction grants.
3. Run `supabase/seed.sql` after the Auth user exists. For a local database, one option is:

   ```bash
   psql "$LOCAL_SUPABASE_DB_URL" -f supabase/seed.sql
   ```

   For a hosted development project, run that version-controlled file using a trusted database connection or the SQL editor. Do not copy the schema into ad hoc dashboard changes.

The idempotent seed associates Sara with **Mó Demo Fasteignasala**, grants Anna seller access and Jón buyer access only to Laugavegur 120, and creates the current fictional transaction, viewing, guests, offer, tasks, and document metadata. Missing customer Auth users are reported and their grants are skipped; rerun the seed after creating them. Seeded documents are metadata examples only, so no corresponding downloadable files are created.

## Agency onboarding and team invitations

An authenticated internal user without an active membership is routed to `/onboarding`. Creating an organization atomically completes the user's profile and creates the first active admin membership. That admin can then finish `/settings`, invite colleagues from `/team`, and create the first property.

Team invitations call Supabase Auth Admin from a server action, so the deployment must provide the server-only `SUPABASE_SERVICE_ROLE_KEY`. Configure the project's Auth site URL/redirect URLs and SMTP before relying on production email delivery. In local development, invitations appear in the local mail catcher; alternatively create the Auth user in Studio and submit the same email in `/team` to attach the existing user. Passwords are never stored in migrations or application tables.

To invite a production customer later, create or invite the Auth identity through the application/admin onboarding workflow, then call `grant_portal_access(transaction_id, user_id, contact_id, role)` as an authorized internal user. Revocation uses `revoke_portal_access(grant_id)` and takes effect immediately. V1 does not require production email delivery yet.

## Security model

- One organization is one real-estate agency/company; offices and branches are not modeled.
- Profiles map one-to-one to `auth.users`; organization roles live only on memberships.
- Properties, transactions, contacts, assignments, parties, histories, and activity carry explicit organization scope.
- Browser-provided organization and actor identities are never accepted without server/database validation. `created_by` comes from `auth.uid()` inside the RPC.
- `create_property_transaction(...)` atomically creates the seller contact, property, transaction, seller party, primary assignment, initial stage history, and activity event.
- `advance_transaction_stage(...)` checks membership/assignment, permits only conservative transitions, and atomically updates current state plus history and activity.
- A deferred database constraint requires `transactions.assigned_agent_id` to match exactly one `primary_agent` assignment.
- Kennitala shown in prototype fields is not submitted or persisted.
- Internal organization membership never grants customer portal access automatically.
- Customer access requires an authenticated profile plus an active `portal_access_grant` for one transaction.
- Seller and buyer routes consume guarded safe RPC projections; customer users do not receive direct offer, review, viewing-guest, party, or activity table access.
- Customer offer lists are transaction-scoped: sellers see only offers deliberately sent to them, while buyers see only offers tied to their own authenticated identity.
- Revoked grants fail authorization immediately.
- Viewing and guest rows are readable only inside an active organization membership. Mutations use guarded RPCs; `internal_notes` is never exposed through a customer projection.
- Tasks and document metadata remain explicitly organization/transaction scoped. Customers use guarded projections which filter by both active portal grant and visibility; they do not receive direct base-table access.
- The migration creates the private `transaction-documents` Storage bucket. Object paths follow `organizations/{organization_id}/transactions/{transaction_id}/{document_id}/{filename}`. The application authorizes the document record before requesting a 60-second signed URL, and Storage RLS separately enforces the same membership/grant and visibility rules.
- Document uploads are limited to 25 MiB by the bucket. No public bucket or permanent public URL is used.
- Stable property slugs are stored on `properties`, unique per organization, and assigned transactionally at property creation. Address changes do not silently change existing routes.
- Property images live in the private `property-images` bucket; signed URLs are generated only after internal membership or transaction-scoped portal authorization.
- Deactivating a membership immediately removes internal RLS access while preserving the profile and historical assignment references.

## Validation commands

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Before production use, run the migrations against a disposable Supabase project and test at least these sessions:

- anonymous: no rows from any Phase 1 application table;
- active demo member: demo organization rows are readable;
- active user in another organization: no demo rows are readable;
- viewer: reads are allowed but `create_property_transaction` is rejected;
- assigned agent: allowed stage transition writes the transaction, one history row, and one activity row together;
- failed property creation: no contact, property, transaction, party, assignment, history, or activity row remains.
- seller: only seller-safe projections for explicitly granted transactions;
- buyer: only buyer-safe property data and the buyer's own offer;
- unrelated authenticated user and revoked grant: all portal projections denied;
- internal agent without a portal grant: internal access remains available, but customer projections are denied.
- seller/buyer: internal tasks and documents remain absent; only role-visible/shared records are returned;
- revoked customer grant: safe projections and document authorization fail immediately;
- document download: a signed URL is generated only after database authorization, and Storage remains private.

## Architecture

See [PRODUCT_V1.md](./PRODUCT_V1.md). It remains the architecture source of truth; the current migrations implement the Phase 1–6 subset through agency readiness.
