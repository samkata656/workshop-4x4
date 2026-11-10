-- No double booking, enforced by Postgres itself.
--
-- btree_gist lets a GiST index compare plain values (bay_id) with "=" next to
-- range values compared with "&&" (overlaps).
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- Rule: no two rows may have the same bay_id AND overlapping [starts_at, ends_at).
-- The range is half-open "[)", so a job ending at 10:00 and another starting at
-- 10:00 in the same bay do NOT collide.
-- Cancelled bookings are left out of the rule, so cancelling frees the slot.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_double_booking"
  EXCLUDE USING gist (
    "bay_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("status" <> 'cancelled');
