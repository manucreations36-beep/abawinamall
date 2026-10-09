# ABAWINA MALL — Phase 1 security report

## Findings
| # | Problem | Where | Risk |
|---|---------|-------|------|
| 1 | `insert into user_roles … select id, 'admin' from auth.users` | migration `20261008123518` | **Every account that existed when it ran is an admin.** |
| 2 | `drop table … cascade` on orders, customers, products, profiles | same migration | Replaying it wipes all business data. Never re-run it. |
| 3 | Re-creates wishlists, reviews, testimonials, newsletter, inquiries | migration `20261009040953` | Fails on replay; added extra **weaker** policies (open newsletter/inquiry inserts, testimonials self-approval) and a duplicate rating trigger. |
| 4 | Browser inserted orders with its own subtotal/total | `src/routes/checkout.tsx` | A shopper could set any price. No stock check, no overselling protection. |
| 5 | `order_items` insert policy `with check (true)` | migration 1 | Anyone could add items to any order. |
| 6 | Customer-typed M-Pesa code stored as if paid | checkout | A code is only a claim, never proof of payment. |
| 7 | `admin_set_staff` looked up editable `profiles.email` | migration `20261008130453` | A user could copy someone's email into their profile. |
| 8 | Anyone could inflate campaign conversions | `bump_campaign_metric` | Misleading reports. |

Admin pages already check `has_role` in the database (RLS), not only in the page. That part is fine.

## What to run (in order)
1. **Backup**: Supabase dashboard → Database → Backups, or `pg_dump "$DB_URL" -Fc -f abawina-before-phase1.dump`.
2. **Staging test (recommended)**: restore the dump into a second Supabase project and run steps 3–4 there first. Test: place a cash order, an M-Pesa order, try to buy more than stock, cancel an order and check stock returns.
3. **Clean up admins** (SQL editor). First see who is admin:
   ```sql
   select u.email, r.created_at from public.user_roles r join auth.users u on u.id = r.user_id where r.role = 'admin';
   ```
   Then keep only the real owners (replace the emails):
   ```sql
   delete from public.user_roles r using auth.users u
   where r.user_id = u.id and r.role = 'admin'
     and lower(u.email) not in ('owner@example.com');
   ```
4. **Run `docs/phase1-security.sql`** in the SQL editor. It is wrapped in one transaction and deletes no data.

The website's new checkout calls `place_order`, so **step 4 must be done before the new checkout goes live**, otherwise orders will fail.

## Initial admin / recovery procedure
Admins can only be granted from the SQL editor (trusted, owner-only) or by an existing admin in the dashboard. If every admin is locked out:
```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where lower(email) = 'owner@example.com'
on conflict do nothing;
```
The database refuses to remove the last admin. Every grant/revoke is logged in `role_audit`.

## Do NOT
- Re-run migrations `20261008123518` or `20261009040953` against the live database.
- Mark an M-Pesa order "paid" without checking the code in the M-Pesa statement. Phase 2 replaces this with automatic Daraja verification.

## Stock rules
- Reserved and deducted when the order is placed (atomic, locked).
- Returned when staff set the order to `cancelled`. A cancelled order cannot be reopened.
