<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- GHL sync uses a fixed studio location, private cron bearer, user-context admin RPCs and database-fenced expiring runs; this prevents public writes, overlapping jobs and false completion signals.
- Sync migrations are staged under supabase/migrations and are applied only after review; no activation or live imports are part of preparation.
- Contact sync requires per-run CRM identity/location verification and confirmed local resolution before event writes; privileged SQL locks and validates the contact pair/snapshot atomically to prevent mixed identities. Protected migration edits are documented as review-only SQL under docs/sql until the authorized migration workflow incorporates them.
- Mobile dashboard and MCP reads share verified identity scope and bounded paginated CRM queries; this prevents unknown-role admin fallback and divergent financial visibility.
- Civil-date periods use timezone-library conversion to half-open UTC boundaries, and incomplete totals are null; this prevents DST boundary errors and sample-based financial claims.
- Legacy Edge Function replacements are staged under docs/edge-review during no-production tasks because existing supabase/functions files deploy automatically; do not wire or copy them into that directory without deployment authorization.
- Agenda modes share a fail-closed identity scope and suppress disabled cached staff/results; this prevents broad week/month queries or cached disclosure before identity resolution.
- The agenda header and day grid share one scoped day-query result; this keeps the compact summary aligned with visible rows without duplicate requests.
- Agenda appointment accents use the existing CRM appointment status, independently of payment badges; this prevents visual confirmation of unverified payments or sessions.
- Finance summaries group by source-specific immutable IDs and expose names only as labels; complete counts are nullable with separate read counts, and contradictory pagination or invalid money invalidates full aggregates to prevent homonym merging and sample-based zeros.
- Daily Agenda swipe handling is confined to the grid with axis locking, edge/multitouch exclusion and tap suppression; route-scoped overscroll cleanup preserves native scrolling and navigation elsewhere.
- Booking date edits invalidate only the active session's time when its Brussels civil day differs; selecting another scheduled session restores its own calendar date to prevent stale-day bookings.
- Projetos do Tatuador read through server-scoped functions (admin all, artist own) that omit gross values for artists and compute cents with null for unconfirmed amounts; prevents cross-artist disclosure and fabricated zeros.
- My Day uses an independent admin-only, paginated local read projection and immutable appointment-ID correlation; unknown arrivals stay unverified and conflicts never create links or trigger CRM writes.
- Appointment journey reuses existing admin-only link discovery and scoped project detail, verifies membership by immutable appointment ID, and never infers appointment nature or commercial status; artists retain their scoped Projects navigation without broadening link access.
- Artist panel is a paginated admin-only local projection scoped by validated artist ID until broad existing RLS is separately reviewed; it exports no finance or inferred appointment types. Commercial presentation uses a separate admin-only read and never jointly deducts deposit annotations and cash without an auditable bridge.
