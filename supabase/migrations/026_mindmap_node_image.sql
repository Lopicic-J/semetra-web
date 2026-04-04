-- Add image_url column to mindmap_nodes for image support in nodes
ALTER TABLE mindmap_nodes
  ADD COLUMN IF NOT EXISTS image_url text DEFAULT NULL;
