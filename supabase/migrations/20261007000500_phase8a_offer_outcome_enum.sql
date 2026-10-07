-- Mó Phase 8A: final internal offer outcomes.
-- Kept separate so the enum values are committed before workflow functions use them.

alter type public.offer_status add value if not exists 'accepted';
alter type public.offer_status add value if not exists 'rejected';
