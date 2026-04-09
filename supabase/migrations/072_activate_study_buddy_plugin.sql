-- ── Activate Study Buddy plugin ──────────────────────────────
-- Study Buddy is an internal feature (no external API keys needed)
-- so it should be active, not coming_soon.

UPDATE plugins SET
  status = 'active'
WHERE id = 'study-buddy';
