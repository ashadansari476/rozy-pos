# Supabase security audit — Phase 1 blockers

The existing `supabase-security.sql` permits **every authenticated account** to read/write **every record** through `using (true) with check (true)`. This is NOT per-shop or per-user isolation. The script also does not remove all old anonymous policies. Do not run it as a production security fix without review.

This branch stops the sync authorization helper from silently falling back to the anonymous key. This client safeguard does not replace database RLS.

Before production: inventory live policies and grants; verify anonymous access is denied; create a test Supabase project; design trusted user-to-shop membership using `auth.uid()`; enforce least-privilege read/write RLS including related financial tables and Storage; migrate existing ownership safely; and test multiple shops and devices. A shared account is not an employee authorization system.

No live database policy changes have been made by this commit.
