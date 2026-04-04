-- Add text_color column to mindmap_nodes for customizable node text color
ALTER TABLE mindmap_nodes ADD COLUMN IF NOT EXISTS text_color TEXT DEFAULT NULL;
