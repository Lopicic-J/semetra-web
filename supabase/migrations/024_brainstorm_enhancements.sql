-- 024: Brainstorming enhancements — hierarchy, notes, priority
ALTER TABLE brainstorm_ideas ADD COLUMN IF NOT EXISTS indent_level integer DEFAULT 0;
ALTER TABLE brainstorm_ideas ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
ALTER TABLE brainstorm_ideas ADD COLUMN IF NOT EXISTS priority text DEFAULT 'none';
