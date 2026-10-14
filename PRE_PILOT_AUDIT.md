# Kelvo — Complete Pre-Pilot Product Audit

**Audit date:** 12 October 2026  
**Audited revision:** `4d08554` (`Add active archive transaction model`)  
**Audit type:** read-only product, workflow, authorization, integrity, UX, time, performance, and failure-mode review

## Executive verdict

Kelvo has a credible and unusually strong technical foundation for this stage: tenant-scoped RLS is pervasive, customer access is transaction-scoped, customer projections deliberately hide internal data, Storage is private, internal MFA is enforced server-side, and the three late-stage milestone workflows are guarded, transactional, and idempotent.

Kelvo is **not yet ready for an unsupervised real-agency pilot**. The main reason is not visual polish. The product does not currently provide a complete operational path through the first five lifecycle stages. An agent can create a property and prepare a listing, but there is no normal UI path for moving the transaction through Verðmat → Undirbúningur → Á sölu → Skoðanir → Tilboð, no UI for scheduling a viewing, and no production UI for granting a seller or buyer portal access. The offer model also permits an expired offer to be progressed to acceptance.

Recommendation: treat the P0 findings and the first wave of P1 integrity/authorization findings as pilot gates. A tightly scripted demonstration using seeded Laugavegur data can work today, but that is materially different from onboarding an agency to operate live transactions.

## Scope and evidence

The audit covered:

- all App Router pages and API delivery endpoints;
- shared loaders, auth routing, date helpers, portal projections, task/document loaders, and property image delivery;
- migrations from the Phase 1 foundation through active/archive guards;
- the current UI actions for properties, listings, viewings, offers, tasks, documents, contacts, team, settings, MFA, invitations, and customer portals;
- the current demo seed architecture and route behavior.

This was a static inspection of the repository and migration definitions. It did **not** connect to the production Supabase project, exercise real email delivery, inspect production query plans/network traces, or run destructive end-to-end scenarios. Findings that depend on deployed Auth/Storage configuration must therefore be verified in a staging project before pilot.

## Top 10 issues before pilot

1. **[F-01, P0]** The first five lifecycle stages have no complete operational progression UI.
2. **[F-02, P0]** There is no production customer invitation/portal-grant workflow, and the buyer role model creates a first-offer onboarding deadlock.
3. **[F-03, P0]** Expired offers can still be approved, sent, receive seller intent, and be internally accepted.
4. **[F-04, P1]** Milestone completion depends on editable Icelandic task titles instead of stable task semantics.
5. **[F-05, P1]** Property-slug routing cannot reliably address transaction history when one property has multiple transactions.
6. **[F-06, P1]** The new-property wizard presents valuation/setup data that it does not persist.
7. **[F-07, P1]** Team invitations can silently activate an existing Auth user and overwrite a global profile across organizations.
8. **[F-08, P1]** Transaction stage and terminal-state guards are incomplete; invalid regressions and post-completion mutations remain possible.
9. **[F-09, P1]** Buyer offer creation and submission are two separate transactions and can leave duplicate/orphan drafts.
10. **[F-10, P1]** Viewer and multi-organization behavior is inconsistent across shell context, tasks, documents, and mutation controls.

---

# Findings

## Workflow and data integrity

### F-01 — Early lifecycle is not operable end to end

- **Severity:** P0 — blocker
- **Area:** property workspace; `/properties/new`; Verðmat, Undirbúningur, Á sölu, Skoðanir, Tilboð; `advance_transaction_stage`
- **Current behavior:** The database exposes `advance_transaction_stage`, but no application action or UI invokes it. The workspace only offers explicit transitions for accepted offer → Samningur, Samningur → Frágangur, Frágangur → Afhending, and Afhending → Lokið. Listing readiness does not move a transaction to `listed`. There is a `create_viewing` RPC, but no route or form calls it. The Skoðanir tab and `/viewings` only list existing records.
- **Why it is a problem:** A newly created real transaction stalls in Verðmat or Undirbúningur. The core pilot workflow can only be demonstrated by pre-seeded state or manual database calls.
- **Expected professional behavior:** Each stage clearly states its entry condition, outstanding requirements, and one guarded next action. Agents can schedule/cancel viewings from the product. Moving to Á sölu, Skoðanir, or Tilboð is deliberate and auditable.
- **Recommended fix:** Add a compact stage action model for the early lifecycle, with confirmations and guarded RPCs for each forward transition; add viewing scheduling/cancellation UI. Define what “published/listed” means internally while external publishing remains out of scope.
- **Schema/migration required:** Yes, recommended, to narrow allowed transitions and add dedicated idempotent milestone functions/reasons; viewing tables already exist.
- **Estimated implementation size:** Large

### F-02 — Customer onboarding and first buyer access are not production-operable

- **Severity:** P0 — blocker
- **Area:** `portal_access_grants`; customer Auth; seller/buyer portal onboarding
- **Current behavior:** `grant_portal_access` and `revoke_portal_access` exist only as RPCs. No internal route or action calls them. There is no customer invite UI. A buyer grant uses role `accepted_buyer`, and the RPC requires that the contact already has an offer on the transaction. Conversely, the buyer offer UI requires that grant before it can create the buyer's first offer.
- **Why it is a problem:** Staff must manually create Auth users and grants. A legitimate prospective buyer cannot naturally receive access and make their first offer. The name `accepted_buyer` is also misleading before an offer is accepted.
- **Expected professional behavior:** An authorized agent selects a transaction party/contact, sends or activates a transaction-scoped portal invitation, sees invited/active/revoked state, and can revoke immediately. A prospective buyer can be granted buyer access without first being the accepted buyer.
- **Recommended fix:** Build the existing grant/revoke workflow into the property workspace, add customer invite acceptance, and separate a customer-safe `buyer`/prospect portal role from final accepted-buyer transaction outcome.
- **Schema/migration required:** Yes for a clean buyer role model; UI/server actions alone are sufficient for seller onboarding.
- **Estimated implementation size:** Large

### F-03 — Offer expiry is presentation-only for most workflow transitions

- **Severity:** P0 — data-integrity/regulatory workflow blocker
- **Area:** offer RPCs; internal offer detail; seller offer response
- **Current behavior:** Creation validates a future `valid_until`, and the UI labels elapsed offers as expired. `submit_offer`, agent approval, send-to-seller, seller-intent, and `confirm_offer_outcome` do not consistently reject `valid_until <= now()`. There is no automatic/status transition to `expired`.
- **Why it is a problem:** An offer that is no longer valid can be shown as expired yet still be advanced and recorded as accepted. UI wording and legal/operational state can contradict each other.
- **Expected professional behavior:** All material offer transitions enforce validity server-side. Expiry is deterministic, visible, and cannot be bypassed by a stale tab or direct RPC call. Any deliberate exception is a separately confirmed, audited action.
- **Recommended fix:** Centralize offer-current validation in the guarded workflow functions; add an idempotent expiry mechanism/query semantics; disable stale UI actions and provide a clear Icelandic message.
- **Schema/migration required:** Yes
- **Estimated implementation size:** Medium

### F-04 — Required lifecycle checklists are identified by editable display titles

- **Severity:** P1 — must fix before pilot
- **Area:** `confirm_contract_signing`, `confirm_transaction_ready_for_handover`, `confirm_transaction_completion`; tasks UI
- **Current behavior:** Each milestone checks completion by exact Icelandic task title. Those tasks use the normal task table and normal edit/status controls. Initialization also de-duplicates by title.
- **Why it is a problem:** Renaming a required task can permanently hide the milestone CTA. A manually created task with the same title can satisfy the gate. Cancellation or title edits can create confusing duplicates on a retry.
- **Expected professional behavior:** Required workflow items have stable machine identities while keeping editable human-facing text where appropriate. The server checks those identities and a workflow instance, not labels.
- **Recommended fix:** Add a nullable semantic key/origin to tasks (for example `workflow_key` and `workflow_instance`), unique per transaction where applicable. Prevent destructive edits to required semantics and migrate existing generated tasks.
- **Schema/migration required:** Yes
- **Estimated implementation size:** Medium

### F-05 — A property slug does not uniquely address a transaction record

- **Severity:** P1 — must fix before pilot
- **Area:** `/properties/[propertySlug]`; buyer/seller routes; property list; completed history
- **Current behavior:** The workspace resolves a property by slug and selects the newest non-completed transaction, otherwise the newest transaction. Every transaction row links to the same property slug. Customer routing also resolves a destination with `.find()` by role and property slug. The schema does not enforce one active transaction per property.
- **Why it is a problem:** A second sale of the same property can make the earlier completed transaction inaccessible by URL. Two active records can be ambiguous. A customer with grants to two transactions for the same property receives identical portal links and may open an arbitrary one.
- **Expected professional behavior:** Every transaction, including historical sales of the same property, has a stable addressable route. At most one active sale workflow exists per property unless the product explicitly supports otherwise.
- **Recommended fix:** Include a transaction identifier/reference in workspace and customer routes or add a dedicated transaction-history selector. Add a partial uniqueness rule for one non-terminal transaction per property if that is the business rule.
- **Schema/migration required:** Yes for uniqueness; route correction itself does not require schema changes.
- **Estimated implementation size:** Large

### F-06 — New-property wizard promises data it discards

- **Severity:** P1 — must fix before pilot
- **Area:** `/properties/new`; `NewPropertyFlow`; `createPropertyTransaction`
- **Current behavior:** The wizard collects kennitala, market valuation, commission, valuation completion, valuation notes, and a setup checklist. The action submits only contact/property basics, asking price, assigned agent, initial stage, and co-owner. It explicitly says kennitala is not verified even though V1 intentionally does not store it. “Sækja upplýsingar um eign” calls `setProperty({...property})` and does nothing. The success copy says next tasks are ready, but setup selections are not persisted or created.
- **Why it is a problem:** Staff believe important professional information was recorded when it was silently lost. The no-op registry button looks broken during a pilot.
- **Expected professional behavior:** Every displayed input is persisted or clearly marked as a non-editable future capability. The final review exactly reflects what will be stored, and setup tasks are created if promised.
- **Recommended fix:** Remove nonfunctional/unsupported fields for the pilot or persist them in an explicit valuation model; translate the setup checklist into real tasks atomically; add per-step validation and accurate success copy.
- **Schema/migration required:** Possibly—yes if valuation/commission/notes are in pilot scope; no if unsupported fields are removed.
- **Estimated implementation size:** Medium to large

### F-07 — Existing-user team invitation can mutate global identity without acceptance

- **Severity:** P1 — must fix before pilot
- **Area:** `/team`; `inviteTeamMember`; Supabase Admin API; profiles
- **Current behavior:** The action lists up to 1,000 Auth users and matches by email. If found, it does not send an invite/acceptance step; it upserts the global profile (`display_name`, `email`, `account_type`) and immediately activates organization membership. The same profile is shared across all organizations.
- **Why it is a problem:** Inviting an existing multi-org user can overwrite their professional identity and account type everywhere. Membership is granted without the user acknowledging the new agency. Pagination also makes email lookup unreliable above 1,000 users.
- **Expected professional behavior:** Organization membership invitations are separate from global identity. Existing users receive and accept a pending organization invitation; organization-specific title/name overrides do not corrupt other agencies.
- **Recommended fix:** Introduce a pending membership invitation record/token or equivalent controlled acceptance flow. Never enumerate the Auth directory for identity lookup. Store org-specific employment metadata on membership where needed.
- **Schema/migration required:** Yes, recommended
- **Estimated implementation size:** Medium to large

### F-08 — Stage regression and terminal-state guards are incomplete

- **Severity:** P1 — must fix before pilot
- **Area:** `advance_transaction_stage`; offer/viewing/listing/task/document mutation RPCs
- **Current behavior:** The general stage RPC allows preparation → valuation, listed → preparation, viewings → listed, offers → viewings, contract → offers, closing → contract, and handover → closing. It does not reconcile accepted offers or generated checklist history when moving backward. Latest guards block *new* offers/viewings only for completed/cancelled transactions; other stages can still receive them. Listing responses, viewing guest changes, task edits, document visibility changes, and deletes remain possible after completion.
- **Why it is a problem:** Direct/stale calls can create contradictory combinations: accepted offer plus offers stage, handover checklist plus contract stage, new viewing in valuation, or altered/deleted archive evidence.
- **Expected professional behavior:** Forward and exceptional backward transitions are explicit workflows with prerequisites, reason, actor, and reconciliation rules. Completed records are read-only except narrowly defined archival corrections.
- **Recommended fix:** Replace broad adjacent regression rules with dedicated guarded operations. Add terminal-stage guards to historical mutations and decide which append-only archive annotations remain allowed.
- **Schema/migration required:** Yes
- **Estimated implementation size:** Medium to large

### F-09 — Buyer create-and-submit is not atomic or resumable

- **Severity:** P1 — must fix before pilot
- **Area:** `/buyer/[propertySlug]/offer`; `createBuyerOffer`
- **Current behavior:** The server action calls `create_customer_offer_draft`, then separately calls `submit_offer`. If submission fails, the UI reports that the offer was saved but provides no draft-resume path. Retrying creates another draft.
- **Why it is a problem:** Network or validation failure can produce duplicate hidden drafts and uncertainty over whether an offer was submitted.
- **Expected professional behavior:** Submit is one atomic guarded transaction, or the wizard explicitly manages a persistent draft ID and resumes it idempotently.
- **Recommended fix:** Prefer one customer-safe RPC that validates, creates/updates, transitions, writes history/activity, and returns the submitted offer. Alternatively expose and resume the existing draft workflow with idempotency keys.
- **Schema/migration required:** Likely yes for a combined/idempotent RPC; no new table is necessarily required.
- **Estimated implementation size:** Medium

### F-10 — Listing readiness is partly manual and image operations invalidate approval unexpectedly

- **Severity:** P1 — must fix before pilot
- **Area:** Skráning tab; listing readiness functions; property image trigger
- **Current behavior:** “Nauðsynleg skjöl tilbúin” is a manual boolean, not derived from document records. Deleting those documents does not invalidate readiness. Conversely, changing image order or cover fires the image trigger, increments `listing_revision`, clears seller approval, and invalidates ready-to-publish state, even when image content did not change.
- **Why it is a problem:** A listing can be marked ready with no required documents, while harmless gallery reordering can silently invalidate a seller-approved listing.
- **Expected professional behavior:** Required-document readiness is traceable to actual required records/checks. Only material customer-visible listing changes invalidate approval, and the user is warned when an action will do so.
- **Recommended fix:** Define required document semantics and derive readiness. Narrow revision invalidation to material content/image-set changes, or explicitly warn and show the resulting reapproval state.
- **Schema/migration required:** Yes for robust required-document semantics; a trigger-only migration can fix image invalidation.
- **Estimated implementation size:** Medium

### F-11 — Seller offer intent is an immediate append-only click without confirmation

- **Severity:** P1 — must fix before pilot
- **Area:** `/seller/[propertySlug]/offers/[offerId]`
- **Current behavior:** Accept, counter-offer, and reject buttons immediately call the append-only response RPC. There is no confirmation dialog. After the first response the UI hides all controls even though the database supports later response rows.
- **Why it is a problem:** A mistaken tap creates permanent workflow history with no clear correction path. On mobile this is especially risky.
- **Expected professional behavior:** Each material intent is confirmed with clear non-binding wording. If corrections are allowed, the UI displays response history and a deliberate “send updated intent” path; otherwise the product explains that staff must be contacted.
- **Recommended fix:** Use the shared confirmation dialog and show the submitted intent/timestamp. Define and enforce whether a later intent is permitted.
- **Schema/migration required:** No for confirmation; possibly a function rule if later responses must be restricted.
- **Estimated implementation size:** Small

### F-12 — Agent offer review records assertions the agent did not actually enter

- **Severity:** P1 — must fix before pilot
- **Area:** internal offer detail; `approve_offer_for_seller`; `offer_reviews`
- **Current behavior:** The review checklist is largely presentational. Approval writes checklist booleans automatically, including financing confirmation state, rather than persisting explicit agent review inputs. Change requests use generic/hard-coded reasoning instead of capturing precise requested changes.
- **Why it is a problem:** The audit record can imply professional checks were completed without the licensed agent affirming them. This is unacceptable evidence quality for a regulated workflow.
- **Expected professional behavior:** The agent explicitly confirms each review item, can record internal notes and a concrete change request, and the server validates required confirmations before approval.
- **Recommended fix:** Make the existing review fields real controlled inputs and include them in a guarded review RPC; require the applicable checklist before send-to-seller.
- **Schema/migration required:** No new table; function replacement may require a migration.
- **Estimated implementation size:** Medium

### F-13 — Viewing follow-up dates are stored as stale relative words

- **Severity:** P1 — must fix before pilot
- **Area:** viewing manager; `next_action`; `follow_up_due_at`
- **Current behavior:** The UI persists values such as `today` and `tomorrow` in `next_action`, ignores `follow_up_due_at`, and sends `p_follow_up_due_at: null` on every update. A value entered today can still say “í dag” days later.
- **Why it is a problem:** Follow-up work becomes misleading and cannot drive a reliable dashboard/task deadline.
- **Expected professional behavior:** Relative copy is derived at render time from a persisted absolute due timestamp. Updating notes must not erase the follow-up date.
- **Recommended fix:** Persist an Iceland-time-derived absolute deadline, retain it on partial updates, and render “í dag/á morgun/komið fram yfir” from that timestamp.
- **Schema/migration required:** No—the column already exists; RPC/UI corrections are needed.
- **Estimated implementation size:** Medium

### F-14 — Viewing state is not enforced during guest/completion operations

- **Severity:** P1 — must fix before pilot
- **Area:** `register_viewing_guest`, `update_viewing_guest`, `complete_viewing`
- **Current behavior:** Guest registration/update functions do not prevent edits after the viewing or transaction is completed. Completion can be called without an explicit check that the viewing has started/ended. There is no cancellation action in the product.
- **Why it is a problem:** A stale tab can mutate historical attendance, and a future viewing can be completed accidentally.
- **Expected professional behavior:** Scheduled/active/completed/cancelled transitions are explicit. Guest edits are allowed only in defined states, with a controlled correction path after completion.
- **Recommended fix:** Add server-side viewing-state and transaction-terminal guards, a guarded cancellation workflow, and clear UI states.
- **Schema/migration required:** Yes, function replacements
- **Estimated implementation size:** Medium

### F-15 — Completed transaction history is not fully retrievable through the UI

- **Severity:** P1 — must fix before pilot
- **Area:** property workspace; Virkni; stage history; archive
- **Current behavior:** The workspace loads only the latest 12 activity events and does not expose transaction stage history. When a newer transaction exists for the same property, older completed transactions cannot be selected. Tasks/documents/offers/viewings remain in storage but are not assembled into a complete historical record.
- **Why it is a problem:** An agent cannot reliably reconstruct what happened months later, despite the database preserving much of the evidence.
- **Expected professional behavior:** A completed transaction has an addressable, read-only record with complete/paginated activity and stage history, and access to all related artifacts.
- **Recommended fix:** Add transaction history selection and paginated history/activity. Present lifecycle timestamps and actor/reason alongside related records.
- **Schema/migration required:** No for UI/history pagination; see F-05 for route/uniqueness changes.
- **Estimated implementation size:** Medium

### F-16 — Cancelled and completed transactions are conflated

- **Severity:** P1 — must fix before pilot
- **Area:** `/properties`, `/offers`, `/viewings`, `/documents`, `/customer/portals`, lifecycle presentation
- **Current behavior:** `lib/properties/list.ts` maps both `completed` and `cancelled` to “Lokið”. Active/archive filters commonly group both together. Customer portal history labels cancelled transactions “Lokið”, while `CustomerJourney` maps `cancelled` to no current stage and offers no cancellation explanation.
- **Why it is a problem:** A cancelled sale is materially different from a completed sale. Customers and staff can be told a failed/withdrawn process was completed.
- **Expected professional behavior:** “Lokið” and “Hætt við” are distinct terminal states everywhere, with separate chips/filter semantics and customer-safe explanatory copy.
- **Recommended fix:** Preserve terminal type in list view models and filters. Add a cancelled customer state and keep it in history without completed wording.
- **Schema/migration required:** No
- **Estimated implementation size:** Small to medium

## Multi-transaction customers and portal behavior

### F-17 — Same-property customer grants collide at the route layer

- **Severity:** P1 — must fix before pilot
- **Area:** `/customer/portals`; `customerPortalPath`; `getCustomerDestinationBySlug`
- **Current behavior:** Portal chooser keys include transaction ID, but links contain only audience + property slug. Resolution selects the first matching grant. Distinct-property multi-grant scenarios work and active items sort first; same-property repeat transactions do not.
- **Why it is a problem:** A seller returning for a later sale of the same property, or a person with historical and active grants for it, may open the wrong transaction.
- **Expected professional behavior:** Portal URLs identify the grant/transaction unambiguously while still using friendly property context.
- **Recommended fix:** Add a safe transaction route token/ID to customer routes or a transaction-specific child route and validate it against active grants.
- **Schema/migration required:** No
- **Estimated implementation size:** Medium

### F-18 — Seller-safe metrics/activity are computed but discarded

- **Severity:** P2 — should fix before wider rollout
- **Area:** `seller_transaction_summary`; `parseSummary`; seller portal
- **Current behavior:** The seller RPC returns aggregate viewing counts and seller-visible activity. `parseSummary` ignores both, and `CustomerPropertyOverview` does not display them. The seller sees the generic property journey/offers/tasks/documents but loses useful safe progress information.
- **Why it is a problem:** The portal under-delivers on its purpose and agents may need to repeat updates manually.
- **Expected professional behavior:** The seller sees the already-authorized aggregate interest summary and concise seller-visible timeline, with no guest identities or internal notes.
- **Recommended fix:** Parse and render the existing safe fields; paginate or cap activity deliberately.
- **Schema/migration required:** No
- **Estimated implementation size:** Small to medium

### F-19 — Customer subsection failures are silently shown as empty content

- **Severity:** P1 — must fix before pilot
- **Area:** buyer/seller overview; `getCustomerWorkItems`; offer/cover/agent loaders
- **Current behavior:** Work-item RPC errors become empty arrays plus an error string, but portal pages ignore that error. Cover/agent failures also silently degrade. A seller listing-review denial/error can replace the entire otherwise valid portal with access denied.
- **Why it is a problem:** A network/database failure looks like “Engin skjöl í boði,” and users may make decisions believing no record exists. One optional subsection can take down the full seller view.
- **Expected professional behavior:** Each customer-safe section has an independent professional error state and retry path; authorization failure is distinguished internally while the public response remains safe.
- **Recommended fix:** Render section-level failures, keep the valid property shell available, and log correlation-safe diagnostics server-side.
- **Schema/migration required:** No
- **Estimated implementation size:** Medium

### Multi-transaction scenario result

| Scenario | Current result | Audit result |
|---|---|---|
| Seller, one active sale | Direct route works if grant exists | Good, but grant must be created manually |
| Seller, two active sales on different properties | `/customer/portals` chooser works | Good |
| Seller, active + completed on different properties | Chooser separates Virkt/Lokið | Good, except cancelled is mislabeled |
| Buyer, one active purchase | Direct route works | Good after manual grant |
| Buyer, multiple active purchases | Chooser works for distinct slugs | Good |
| Buyer, active + completed | Active appears first; history remains accessible | Good for distinct slugs |
| Same person buyer on one / seller on another | Role-specific routes and grants remain separate | Good |
| Multiple grants for repeat transactions on same property | Both links resolve to the same slug-only URL | Fails; see F-05/F-17 |
| Revoked grant | RPC checks active status on each request | Good; access is removed immediately |
| Cross-transaction data | Safe RPCs validate transaction grant/offer ownership | Good; no direct leak found |

## Authorization and security

### F-20 — Organization context is inconsistent for multi-org staff

- **Severity:** P1 — must fix before pilot if multi-agency users are allowed
- **Area:** `requireInternalIdentity`; `/tasks`; `/documents`; settings/shell
- **Current behavior:** Internal identity chooses the earliest active membership and has no organization switcher. `getInternalWorkItems` independently resolves *all* active memberships and merges tasks, documents, transactions, and assignees across them. The topbar/settings/properties still show only the selected first organization.
- **Why it is a problem:** The UI can show Agency B work inside an Agency A-branded shell. This is authorized by RLS but operationally dangerous; a user can select the wrong transaction/assignee.
- **Expected professional behavior:** One explicit organization context applies to every loader/action, or the product formally does not support simultaneous memberships.
- **Recommended fix:** Add server-owned organization selection and pass the selected organization ID consistently. Never infer “all memberships” in an operational screen.
- **Schema/migration required:** No, unless a persisted default/current organization is desired.
- **Estimated implementation size:** Medium

### F-21 — Viewer UI and mutation controls do not match server authorization

- **Severity:** P1 — must fix before pilot
- **Area:** `/tasks`; `/documents`; role model
- **Current behavior:** Tasks and documents pages call `requireInternalIdentity` but discard the role and always render create/edit/complete/cancel/upload/delete controls. RPCs correctly reject viewers through `can_manage_transaction`.
- **Why it is a problem:** Read-only users are invited to perform actions that fail with backend errors. This undermines trust and makes permissions appear broken.
- **Expected professional behavior:** Viewer controls are absent or clearly read-only; server/RPC enforcement remains the final boundary.
- **Recommended fix:** Pass a role/capability object to managers and disable/hide mutations. Keep server checks unchanged.
- **Schema/migration required:** No
- **Estimated implementation size:** Small

### F-22 — Agent authorization is inconsistent between transaction work and property images/contacts

- **Severity:** P1 — must fix before pilot
- **Area:** property images; contacts; `can_operate_organization` vs `can_manage_transaction`
- **Current behavior:** Listing, offer, viewing, task, and document operations generally require assignment or admin/coordinator rights. Property image RPC/Storage rules permit any admin/agent/coordinator in the organization, and the UI enables images for every non-viewer. Contacts are similarly organization-operator scoped.
- **Why it is a problem:** The product promise says agents work on transactions they are allowed to handle, but an unassigned agent can alter images for another agent's property. Permission expectations are not explicit.
- **Expected professional behavior:** A documented permission matrix is applied consistently. Shared CRM edits may be org-wide by policy, but transaction media should follow transaction assignment or an explicit shared-work rule.
- **Recommended fix:** Define capabilities centrally and align UI, RPCs, and Storage policies with that matrix.
- **Schema/migration required:** A policy/function migration is likely required.
- **Estimated implementation size:** Medium

### F-23 — No automated tenant/workflow regression suite exists

- **Severity:** P1 — must fix before pilot
- **Area:** test infrastructure; RLS; RPCs; Auth; Storage
- **Current behavior:** No pgTAP/SQL policy tests, integration tests, or application test files were found. Security and idempotency behavior is encoded in migrations but protected only by manual validation.
- **Why it is a problem:** The product has many SECURITY DEFINER functions and repeated CREATE OR REPLACE migrations. A later function replacement can silently lose a stage, expiry, role, or terminal-state check.
- **Expected professional behavior:** CI proves cross-org denial, role denial, grant revocation, customer projection safety, milestone idempotency, and archive guards against a reset database.
- **Recommended fix:** Add database/RPC tests first, then a small Playwright happy-path/auth matrix. Include migration reset and seed repeatability in CI.
- **Schema/migration required:** No
- **Estimated implementation size:** Large

### Security posture that passed inspection

- Application-table RLS is enabled and base-table writes are generally revoked in favor of guarded RPCs.
- Composite organization foreign keys prevent tasks, documents, offers, parties, grants, viewings, and images from being attached across tenants.
- Customer reads use transaction-scoped SECURITY DEFINER projections rather than broad base-table access.
- Buyer offer projections hide seller intent and competing offers; seller projections hide internal review data and viewing guest identities.
- Private image/document endpoints return 404 for denied/nonexistent resources and do not expose signed Supabase URLs.
- Service-role usage is server-only and limited to team/Auth administration; no service-role key is imported into browser code.
- Internal routes require active membership and AAL2; MFA enforcement is server-side, not merely visual.
- Portal revocation is checked per request and immediately removes customer access.
- Seller offer responses and offer status history are append-only at the database layer.

## UX, professional behavior, and failure handling

### F-24 — Contact directory errors become a false empty state; detail exposes raw enums

- **Severity:** P1 — must fix before pilot
- **Area:** `/contacts`; `/contacts/[contactId]`
- **Current behavior:** The contacts index ignores the Supabase query error and maps `data ?? []`, so a failed load appears as an empty directory. Contact detail prints raw `party.role`, `transaction.stage`, attendance, and interest values such as `seller · contract` and `attended · very_interested`.
- **Why it is a problem:** Staff cannot distinguish no customers from a data outage, and raw database language is visibly unfinished.
- **Expected professional behavior:** Safe Icelandic error state with retry; all relationship, stage, attendance, and interest values use centralized Icelandic labels.
- **Recommended fix:** Handle/log the query error and use existing model label helpers or one centralized status dictionary.
- **Schema/migration required:** No
- **Estimated implementation size:** Small

### F-25 — Raw backend errors can reach internal users and there are no route error boundaries

- **Severity:** P1 — must fix before pilot
- **Area:** tasks/documents/team actions; route errors; `error.tsx`
- **Current behavior:** Task/document actions throw `error.message` from Supabase, and client managers display the caught message. No App Router `error.tsx` files exist. Some loaders catch and localize errors, while others throw to the generic Next error page.
- **Why it is a problem:** Users may see English/database implementation details, and failures are inconsistent across routes.
- **Expected professional behavior:** Mutations map known error codes to safe Icelandic messages, retain detailed server logs, and route segments have branded recovery states.
- **Recommended fix:** Add a shared safe action-error mapper and scoped Kelvo error boundaries for internal and customer shells.
- **Schema/migration required:** No
- **Estimated implementation size:** Medium

### F-26 — Destructive document and image actions lack confirmation and are not atomic across Storage/metadata

- **Severity:** P1 — must fix before pilot
- **Area:** document manager; property image manager; Storage cleanup
- **Current behavior:** Document and image trash buttons delete immediately. Both flows remove the Storage object before deleting metadata; a metadata failure leaves a broken record. Upload creates document metadata before Storage and attempts cleanup, but cleanup failure can leave orphan metadata/object state.
- **Why it is a problem:** Accidental deletion is irreversible, and partial failure produces missing downloads or orphan files.
- **Expected professional behavior:** Destructive actions use confirmation, archive where appropriate, and a server-owned transactional/compensating workflow records failure for retry.
- **Recommended fix:** Add shared confirmation. Prefer metadata “archived/deletion pending” state or a guarded server workflow that makes reconciliation observable; add an orphan audit job/admin report.
- **Schema/migration required:** Possibly for archive/reconciliation state; confirmation alone does not.
- **Estimated implementation size:** Medium

### F-27 — Document upload is vulnerable to request-size and file-policy failures

- **Severity:** P1 — must fix before pilot
- **Area:** `/documents`; `uploadDocumentAction`; `transaction-documents` bucket
- **Current behavior:** File bytes are posted through a Next Server Action. The private bucket permits any MIME type up to 25 MB, while the UI/action does not enforce an explicit supported-type allowlist or client size ceiling. Raw upload errors can be displayed.
- **Why it is a problem:** Production Vercel body limits can reject normal documents before the action runs, and arbitrary file types can be stored in a business document repository.
- **Expected professional behavior:** Direct authenticated browser-to-private-Storage upload (as property images already do), per-file validation, controlled document MIME allowlist, guarded metadata finalization, and safe partial-failure cleanup.
- **Recommended fix:** Reuse the property-image direct-upload pattern for documents, with PDF/DOCX and explicitly approved formats and a 25 MB-or-lower client/server limit.
- **Schema/migration required:** No schema change; Storage bucket configuration/policy migration may be appropriate for MIME enforcement.
- **Estimated implementation size:** Medium

### F-28 — Dashboard “next action” is usually generic and not user-specific

- **Severity:** P1 — must fix before pilot
- **Area:** dashboard; `getIndexedProperties`; attention list
- **Current behavior:** Property next action looks for activity event type `next_action`, but current workflows do not generate that event type, so rows commonly show “Fara yfir næstu skref”. Attention includes all organization tasks, not primarily tasks assigned to the signed-in user.
- **Why it is a problem:** The daily home page does not reliably answer the agent's most important question: “What do I need to do next?”
- **Expected professional behavior:** Next action is derived from active workflow prerequisites, overdue/assigned tasks, next viewing, and offer deadlines, with personal work first and organization exceptions clearly marked.
- **Recommended fix:** Build a deterministic next-action projection from existing stage/task/viewing/offer data rather than optional prose events; pass current user ID into dashboard prioritization.
- **Schema/migration required:** No initially; a materialized/work-queue model may be useful later.
- **Estimated implementation size:** Medium

### F-29 — Seller/customer terminology has incomplete terminal and empty states

- **Severity:** P2 — should fix before wider rollout
- **Area:** customer overview; offer list; lifecycle
- **Current behavior:** The offer panel empty state says “Engin virk tilboð” even on completed history. Cancelled transactions have no coherent customer copy. Some internal event summaries from older portal functions remain English (`Customer portal access granted/revoked`) unless manually normalized.
- **Why it is a problem:** Historical screens read as current/empty rather than archived, and mixed-language activity looks unfinished.
- **Expected professional behavior:** Copy reflects current, completed, and cancelled context; all generated and historical presentation is Icelandic.
- **Recommended fix:** Add context-aware empty states and extend presentation normalization while replacing English strings in future-generating RPCs.
- **Schema/migration required:** A function-replacement migration is needed for future activity strings; presentation fix needs none.
- **Estimated implementation size:** Small

### F-30 — Onboarding remains visually and operationally separate from the production shell

- **Severity:** P2 — should fix before wider rollout
- **Area:** `/onboarding`
- **Current behavior:** The route still uses the old dark Mó-style canvas/classes and a compressed form implementation. It creates an organization for an authenticated internal profile but does not guide the admin through explicit MFA, settings completeness, team invite, and first property readiness.
- **Why it is a problem:** The first real agency experience looks older than the rest of Kelvo and stops before confirming the setup is operational.
- **Expected professional behavior:** Kelvo-branded onboarding with clear prerequisites and a checklist linking to settings/team/property creation, without bypassing MFA.
- **Recommended fix:** Reskin using existing primitives and add a lightweight post-create checklist using existing routes—no new product module required.
- **Schema/migration required:** No
- **Estimated implementation size:** Small to medium

## Time and date behavior

### F-31 — Long-lived pages do not update time-sensitive status

- **Severity:** P2 — should fix before wider rollout
- **Area:** dashboard, `/offers`, `/viewings`, `/tasks`, offer/customer views
- **Current behavior:** Server pages pass one `nowIso` snapshot to client filters. A tab left open across an offer deadline, viewing start/end, due time, or midnight continues to show the old status until navigation/refresh. Viewing follow-up has the separate absolute-date problem in F-13.
- **Why it is a problem:** A deadline can remain “valid” and a viewing “framundan” in a stale browser session after time has passed.
- **Expected professional behavior:** Time-sensitive screens refresh/recompute at the next relevant boundary or visibly state their update time.
- **Recommended fix:** Schedule lightweight client recomputation/timed refresh at relevant deadlines and on visibility regain. Server-side workflow validation must remain authoritative.
- **Schema/migration required:** No
- **Estimated implementation size:** Small to medium

### Timezone findings

The core date helper is implemented well:

- formatting uses explicit `is-IS` and `Atlantic/Reykjavik`;
- dashboard day boundaries are derived in Iceland time;
- offer/viewing comparisons use instants, not formatted text;
- Date/Time controls use explicit Iceland-time conversion;
- appending `Z` to Iceland local datetime values is currently correct because Iceland remains on UTC year-round.

No remaining hydration mismatch caused by implicit browser locale was found in the audited viewing/dashboard paths. The major time risks are semantic expiry enforcement (F-03), stale follow-up storage (F-13), and long-lived client snapshots (F-31), not basic timezone formatting.

## Performance and scalability

### F-32 — Operational indexes load complete tenant datasets and paginate only in the browser

- **Severity:** P2 — should fix before wider rollout
- **Area:** `/properties`, `/contacts`, `/offers`, `/viewings`, `/tasks`, `/documents`
- **Current behavior:** Each route selects all matching organization rows, often with nested parties/guests/relations, then filters and “paginates” the in-memory array. “Sýna fleiri” limits rendering but not database transfer or server work.
- **Why it is a problem:** Performance and memory grow with the agency's entire history. Completed archive data still transfers on every default active view.
- **Expected professional behavior:** Server query filters active/archive, search, sort, and cursor/page limits; client state requests the next bounded page.
- **Recommended fix:** Move default filters and 20–25 row limits into organization-scoped queries/RPCs, with indexed cursor pagination. Keep client-side filtering only for the loaded window.
- **Schema/migration required:** Possibly for targeted indexes; no schema redesign required.
- **Estimated implementation size:** Medium to large

### F-33 — Property workspace and offer detail overfetch

- **Severity:** P2 — should fix before wider rollout
- **Area:** `/properties/[propertySlug]`; internal offer detail; customer offer detail
- **Current behavior:** Every workspace visit loads candidate transactions, all current viewings/offers/conditions, latest activities, listing response, all transaction tasks/documents/profiles, and all images regardless of selected tab. Internal offer detail also runs its own offer query plus six relation queries plus a property query while concurrently loading the entire workspace merely to validate the slug/offer relationship. Customer offer detail resolves destination then summary sequentially and separately requests the offer plus the transaction offer list.
- **Why it is a problem:** Simple detail navigation performs much more database and image metadata work than the screen needs.
- **Expected professional behavior:** A small authorized offer-detail projection returns offer + property context in one call. Workspace hero/lifecycle load first and tab-specific bodies query only their data.
- **Recommended fix:** Add narrow server loaders/RPC projections, validate offer/slug in the same query, and stream tab bodies or fetch them on navigation.
- **Schema/migration required:** No schema change; optional safe RPC migration.
- **Estimated implementation size:** Medium

### F-34 — Dashboard performs broad aggregate work in application memory

- **Severity:** P2 — should fix before wider rollout
- **Area:** dashboard loader
- **Current behavior:** The dashboard runs seven parallel sources, including all organization tasks, all active-status offers, all viewings, and all viewing guests, then joins/counts them in JavaScript. `getIndexedProperties` additionally embeds all activity events per transaction before selecting a nonexistent/rare `next_action` type.
- **Why it is a problem:** The home page cost grows with lifetime guest and activity volume, even though it renders only three properties and a few attention items.
- **Expected professional behavior:** Database-side counts and limited projections return only dashboard fields for active transactions and relevant user work.
- **Recommended fix:** Create a tenant/user-scoped dashboard RPC or several bounded aggregate queries; remove full activity and viewing-guest transfers.
- **Schema/migration required:** Optional RPC migration and indexes
- **Estimated implementation size:** Medium

### F-35 — Team page performs one Auth Admin request per member

- **Severity:** P2 — should fix before wider rollout
- **Area:** `/team`
- **Current behavior:** The page loads memberships, then calls `admin.auth.admin.getUserById` for every member to derive invite state.
- **Why it is a problem:** Team page latency and Auth Admin rate pressure scale linearly with staff count; one failed Admin lookup can disrupt the whole `Promise.all`.
- **Expected professional behavior:** Invite state is application-owned/readable in one query or fetched in a bounded batch with partial-failure handling.
- **Recommended fix:** Persist invitation lifecycle on an organization invitation/membership model (also resolving F-07) and avoid Auth N+1 calls.
- **Schema/migration required:** Yes if invite state is moved to application data.
- **Estimated implementation size:** Medium

### F-36 — Image delivery is secure and sized, but fallback transformations are recomputed

- **Severity:** P2 — should fix before wider rollout
- **Area:** `/api/property-images/[imageId]`; `/api/profile-images/[userId]`
- **Current behavior:** Stable Kelvo URLs, ETags, private cache headers, lazy loading, and appropriate renditions are in place. Supabase transformations are preferred. If unavailable, each cache miss downloads the private original and runs Sharp in the serverless request because the endpoint/upstream is `force-dynamic`/`no-store`; there is no persistent derivative cache.
- **Why it is a problem:** Image-heavy properties can create repeated compute/origin cost across users or after one-hour browser revalidation, especially on a Supabase plan without transformations.
- **Expected professional behavior:** Transform support is verified in the pilot project, or deterministic private derivatives are generated once and reused.
- **Recommended fix:** Confirm Storage Image Transformations in staging and measure response sizes. If unavailable, generate private derivatives on upload/backfill and serve them through the same authorization endpoint.
- **Schema/migration required:** Possibly no schema if paths are deterministic; Storage backfill/manual job required.
- **Estimated implementation size:** Medium

## Route-by-route operational audit

| Route/area | Current professional readiness | Primary gaps |
|---|---|---|
| `/` | Real data, Icelandic upcoming logic, useful shell | Generic next action; broad aggregation; not user-prioritized |
| `/properties` | Stable slugs, search, active/all/completed-style filtering | Cancelled conflation; no server pagination; same-property transaction ambiguity |
| `/properties/new` | Atomic base creation and good visual flow | Several fields/checklists discarded; no-op registry action; weak step validation |
| `/properties/[slug]` | Strong hero/lifecycle/tabs and late-stage milestone cards | No early-stage next actions; all tabs overfetch; only latest 12 activities; archive ambiguity |
| `/viewings` | Useful global list and time-aware display | No create/cancel; full-dataset load; status snapshot can go stale |
| viewing detail | Attendance/interest/notes/walk-in/completion persist | Relative follow-up corruption; post-completion editing; future-completion guard absent |
| `/offers` | Operational filters/search and context-preserving links | Expiry not authoritative; full-dataset load; cancelled conflation |
| internal offer detail | Safe internal detail and milestone actions | Review assertions not explicit; heavy query path |
| `/tasks` | Dense, filterable active default; milestone tasks reusable | Viewer sees controls; all memberships merged; archive tasks mutable; raw RPC errors |
| `/documents` | Private delivery, filters, categories, searchable property selector | Server-action file bytes; no confirm; viewer controls; archive mutable |
| `/contacts` | Useful directory/search/create/edit | Index swallows errors; no pagination; detail exposes raw enums |
| `/team` | Admin-only server mutations; last-admin protection; MFA-capable invite acceptance | Existing-user invite/profile corruption; Auth N+1 |
| `/settings` | Admin org settings, profile crop/versioning, MFA management | Logo upload still uses server action; no explicit recovery if storage/profile update partially fails |
| `/onboarding` | Can create first organization without seed | Old visual system; incomplete guided readiness |
| `/customer/portals` | Active/history grouping and role labels | Slug collision; cancelled shown as completed; onboarding absent |
| buyer portal | Own offers only, safe docs/tasks, completed state | First-offer grant deadlock; subsection errors hidden |
| seller portal | Safe listing/offer/docs/tasks and completed state | Safe viewing/activity data discarded; response action confirmation absent |
| Auth/MFA/reset | Generic errors, PKCE/token-hash redirects, AAL2 enforcement | Must verify production email/rate-limit/redirect configuration externally |
| private media APIs | RLS/RPC-authorized, private, provider URL hidden | Image fallback compute cost; document no-store is secure but adds repeated origin latency |

## End-to-end workflow audit

| Stage | Entry | Current user experience/actions | Progression gate and result | Portal/list/dashboard effect | Gap assessment |
|---|---|---|---|---|---|
| **Verðmat** | New property may start here | Basic facts exist; wizard valuation UI is not persisted | DB RPC permits move to Undirbúningur, but no product action | Property appears active; generic next action | **Dead end** |
| **Undirbúningur** | Creation or DB stage change | Listing preparation, images, tasks/docs, seller approval, ready-to-publish | Readiness can be marked, but does not move to Á sölu | Seller review works only after manual grant | **Dead end after ready** |
| **Á sölu** | Only via unseen/manual stage RPC | Workspace displays stage; no publish integration by design | No UI to move to Skoðanir or schedule a viewing | Active lists only | **Dead end** |
| **Skoðanir** | Only via stage RPC/manual state | Existing viewing guest management works | No create/cancel UI; completion does not define transaction progression | Completed viewing persists; dashboard future list works | **Operationally incomplete** |
| **Tilboð** | Stage RPC or offer activity; accepted workflow can start from listed/viewings/offers | Buyer submission, agent review, seller intent, agent acceptance | Acceptance atomically supersedes competing active offers and moves to Samningur | Customer status updates; contract tasks created | **Strong path, but expiry/onboarding/review gaps** |
| **Samningur** | Guarded agent acceptance | Six-task checklist; CTA appears only at 6/6 | Explicit confirmed signing atomically moves to Frágangur | Safe customer copy; five closing tasks | **Strong, subject to title-key flaw** |
| **Frágangur** | Confirmed signing | Five-task checklist; completion CTA | Explicit confirmation moves to Afhending and creates five tasks | Customer journey updates | **Strong, subject to title-key flaw** |
| **Afhending** | Confirmed closing completion | Five-task checklist; final CTA | Explicit confirmation moves to Completed | Customer completed state; dashboard active count drops | **Strong, subject to title-key flaw** |
| **Completed/archive** | Guarded completion only | Lifecycle shows complete and records remain | General stage RPC cannot leave completed | Active lists mostly exclude; portals keep access | **Preservation good; addressability/mutability/cancelled semantics incomplete** |

## Failure and edge-case audit summary

| Edge case | Current handling | Result |
|---|---|---|
| Network failure during buyer offer submit | Draft may remain; retry duplicates | Fails professional expectation |
| Network failure during document upload | Best-effort metadata cleanup | Partial orphan risk remains |
| Network failure during image upload | Direct upload + best-effort object cleanup | Generally good; cleanup failure is surfaced |
| Invalid/oversized property image | Per-file validation; valid batch files continue | Good |
| Invalid document type/size | No strict allowlist/client size guard | Gap |
| Expired team invite | Branded safe invalid/expired state | Good |
| Revoked portal grant | Rechecked by transaction-scoped RPC | Good |
| Stale milestone tab/double click | Row locking/idempotent late-stage RPCs | Good |
| Stale viewing/offer tab | Missing state/expiry checks in several RPCs | Gap |
| Unauthorized/nonexistent media UUID | Same 404 response | Good |
| Unauthorized internal mutation | Guarded RPC denies | Good, but viewer UI mismatch |
| Back after milestone | Revalidation and idempotency protect late stages | Good |
| Same property sold again | Slug selects newest transaction | Gap |
| Completed transaction | Data retained; active filters mostly exclude | Good foundation; archive remains mutable/ambiguous |

## Things implemented well — do not redesign

1. **Tenant foundation:** organization IDs plus composite foreign keys and RLS form a sound isolation model.
2. **Guarded late lifecycle:** acceptance, signing, closing-to-handover, and final completion use row locks, server authorization, history/activity writes, and retry-safe behavior.
3. **Customer-safe projections:** seller and buyer RPCs are deliberately scoped and avoid broad base-table grants.
4. **Portal revocation:** active grants are evaluated on every request; revocation is immediate.
5. **Private media delivery:** Storage remains private, browser URLs stay on Kelvo, and unauthorized resource existence is not disclosed.
6. **Property image manager:** direct-to-Storage upload, stable image IDs/URLs, optimistic order/cover changes, thumbnail renditions, lazy decode, and cleanup are the right architecture.
7. **MFA:** internal AAL2 is enforced in the server-side identity gate; TOTP challenge auto-submit retains accessible fallback.
8. **Authentication routing:** internal/customer identities are not automatically conflated; customer grants and internal memberships determine destination.
9. **Stable property slugs:** organization-scoped collision-safe slugs are appropriate as property identifiers; only transaction history needs an additional key.
10. **Icelandic date utilities:** explicit locale/timezone handling is centralized and avoids hydration mismatches.
11. **Append-only seller offer intent/history:** preserving response history is correct.
12. **Kelvo shell and control system:** the current shared design primitives, persistent internal shell, customer shell, and restrained status language should be refined rather than replaced.

## Recommended implementation order

### Gate 1 — Make the core workflow genuinely operable

1. Fix offer expiry enforcement (F-03).
2. Implement explicit early-stage progression and viewing create/cancel (F-01).
3. Implement production customer invitations/grants and a real prospective-buyer role (F-02).
4. Replace title-based required task identity (F-04).
5. Restrict invalid regressions and terminal mutations (F-08/F-14).

### Gate 2 — Protect identity, authorization, and evidence

6. Correct team invitation architecture (F-07).
7. Fix viewer/multi-org/agent capability consistency (F-20/F-21/F-22).
8. Make buyer offer submission atomic/idempotent (F-09).
9. Make transaction history addressable and distinguish cancelled from completed (F-05/F-16/F-17).
10. Add RLS/RPC/integration regression tests (F-23) before further workflow migrations.

### Gate 3 — Remove pilot-facing trust failures

11. Correct the new-property wizard's persistence promises and no-op action (F-06).
12. Make offer review and seller intent deliberate evidence-bearing actions (F-11/F-12).
13. Fix listing readiness/document evidence and image invalidation semantics (F-10).
14. Fix viewing follow-up dates (F-13).
15. Localize/safely handle contact/action/error states and add error boundaries (F-24/F-25/F-29).
16. Add confirmations and safer Storage/metadata deletion behavior (F-26).
17. Move document bytes off Server Actions and enforce file policy (F-27).

### Gate 4 — Pilot performance and daily usefulness

18. Derive actionable, user-prioritized dashboard work (F-28).
19. Move operational list filtering/pagination to bounded server queries (F-32).
20. Narrow workspace/offer detail loading and dashboard aggregates (F-33/F-34).
21. Remove Auth Admin N+1 through the invitation redesign (F-35).
22. Verify Supabase image transforms or deploy deterministic private derivatives (F-36).
23. Add time-boundary refresh behavior (F-31) and finish the seller-safe metrics/activity presentation (F-18/F-19).

## Pilot go/no-go checklist

Kelvo should be considered ready for a controlled agency pilot only when all of the following are true in a staging reset using non-demo accounts:

- an admin can invite staff and customers without SQL/dashboard intervention;
- an agent can create a property and advance every stage to completion using only product UI;
- a viewing can be scheduled, cancelled, completed, and followed up without stale relative dates;
- an expired offer cannot progress through any route/RPC;
- seller intent, agent review, and final acceptance are distinct, confirmed, and auditable;
- required workflow tasks cannot be bypassed or broken by renaming;
- repeated/same-property transactions have distinct accessible history;
- viewer, agent, coordinator, and admin UI capabilities match server enforcement;
- completed/cancelled records are clearly distinguished, preserved, and protected from accidental mutation;
- automated tests prove cross-tenant denial, customer projection safety, revocation, expiry, and milestone idempotency;
- document uploads work through production hosting limits and destructive actions are confirmed;
- staged email redirects/templates, MFA, Storage transformations, and rate limits have been verified in the deployed Supabase/Vercel environment.

