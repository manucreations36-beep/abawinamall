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

## Architecture rules
- Shopper-facing price always comes from `src/lib/pricing.ts` (`effectivePrice`) — one place decides when a flash deal applies.
- Recently viewed products live in browser storage only — no account needed and no server load.
- Public order tracking goes through the `track_order` database function requiring order number + phone — orders table itself stays private.

- Orders are created only through the `place_order` database function; the browser never sends prices or totals. Why: prevents price tampering and overselling.
- Admin roles are granted only via the SQL editor or `admin_set_staff`; never in migrations. Why: an earlier migration made every user admin (see SECURITY.md).
- Schema changes for the live database ship as reviewed SQL in docs/ until the project's own database is connected to Lovable. Why: no migration tool access to it here.
- Customer SMS are queued in sms_outbox by database triggers; a sender drains the queue. Why: status changes stay atomic and work before a provider is connected.
