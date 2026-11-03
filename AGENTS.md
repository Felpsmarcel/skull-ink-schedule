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
