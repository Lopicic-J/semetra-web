-- Semetra Web — Schema Extension v2
-- Run this in the Supabase SQL Editor after 001_initial.sql

-- ── Extend modules table with full desktop fields ─────────────────────────────
ALTER TABLE modules ADD COLUMN IF NOT EXISTS code              text;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS link              text;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS status           text DEFAULT 'active';
ALTER TABLE modules ADD COLUMN IF NOT EXISTS exam_date         text;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS weighting        numeric DEFAULT 1;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS github_link      text;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS sharepoint_link  text;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS literature_links text;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS notes_link       text;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS module_type      text DEFAULT 'pflicht';
ALTER TABLE modules ADD COLUMN IF NOT EXISTS in_plan          boolean DEFAULT true;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS target_grade     numeric;

-- ── Extend topics table with spaced repetition fields ────────────────────────
ALTER TABLE topics ADD COLUMN IF NOT EXISTS knowledge_level  integer DEFAULT 0;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS last_reviewed    timestamptz;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS sr_easiness      numeric DEFAULT 2.5;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS sr_interval      integer DEFAULT 1;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS sr_repetitions   integer DEFAULT 0;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS sr_next_review   timestamptz;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS task_id          uuid;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS updated_at       timestamptz DEFAULT now();

-- ── module_scraped_data: Inhalte aus FH-Portal ───────────────────────────────
CREATE TABLE IF NOT EXISTS module_scraped_data (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  module_id   uuid REFERENCES modules(id) ON DELETE CASCADE,
  data_type   text NOT NULL DEFAULT 'objective', -- 'objective' | 'content_section' | 'assessment'
  title       text NOT NULL,
  body        text,
  weight      numeric DEFAULT 1,
  sort_order  integer DEFAULT 0,
  checked     boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE module_scraped_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scraped_own" ON module_scraped_data FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── studiengaenge: Vordefinierte FFHS-Programme ───────────────────────────────
CREATE TABLE IF NOT EXISTS studiengaenge (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          text NOT NULL,                 -- "Wirtschaftsinformatik BSc"
  fh            text NOT NULL DEFAULT 'FFHS',  -- Hochschule
  abschluss     text DEFAULT 'BSc',
  semester_count integer DEFAULT 6,
  ects_total    integer DEFAULT 180,
  modules_json  jsonb,                         -- Vordefinierte Module
  created_at    timestamptz DEFAULT now()
);

-- FFHS Wirtschaftsinformatik BSc — Muster-Module
INSERT INTO studiengaenge (name, fh, abschluss, semester_count, ects_total, modules_json)
VALUES (
  'Wirtschaftsinformatik BSc', 'FFHS', 'BSc', 6, 180,
  '[
    {"name":"Mathematik 1","code":"MAT1","ects":4,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
    {"name":"Programmieren 1","code":"PRG1","ects":4,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
    {"name":"Wirtschaftsinformatik Grundlagen","code":"WIG","ects":4,"semester":"HS1","module_type":"pflicht","color":"#059669"},
    {"name":"Betriebswirtschaft 1","code":"BWL1","ects":4,"semester":"HS1","module_type":"pflicht","color":"#d97706"},
    {"name":"Datenbanken 1","code":"DB1","ects":4,"semester":"HS1","module_type":"pflicht","color":"#dc2626"},
    {"name":"Mathematik 2","code":"MAT2","ects":4,"semester":"FS2","module_type":"pflicht","color":"#6d28d9"},
    {"name":"Programmieren 2","code":"PRG2","ects":4,"semester":"FS2","module_type":"pflicht","color":"#2563eb"},
    {"name":"Betriebswirtschaft 2","code":"BWL2","ects":4,"semester":"FS2","module_type":"pflicht","color":"#d97706"},
    {"name":"Datenbanken 2","code":"DB2","ects":4,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
    {"name":"Rechnungswesen","code":"REW","ects":4,"semester":"FS2","module_type":"pflicht","color":"#db2777"},
    {"name":"Software Engineering","code":"SE","ects":4,"semester":"HS3","module_type":"pflicht","color":"#2563eb"},
    {"name":"Netzwerke & IT-Sicherheit","code":"NIS","ects":4,"semester":"HS3","module_type":"pflicht","color":"#dc2626"},
    {"name":"Business Intelligence","code":"BI","ects":4,"semester":"HS3","module_type":"pflicht","color":"#059669"},
    {"name":"Statistik & Datenanalyse","code":"STAT","ects":4,"semester":"HS3","module_type":"pflicht","color":"#6d28d9"},
    {"name":"Projektmanagement","code":"PM","ects":4,"semester":"FS4","module_type":"pflicht","color":"#d97706"},
    {"name":"Enterprise Architecture","code":"EA","ects":4,"semester":"FS4","module_type":"pflicht","color":"#2563eb"},
    {"name":"IT-Governance & Compliance","code":"ITGC","ects":4,"semester":"FS4","module_type":"pflicht","color":"#dc2626"},
    {"name":"ERP-Systeme","code":"ERP","ects":4,"semester":"FS4","module_type":"pflicht","color":"#059669"},
    {"name":"Bachelor-Thesis","code":"BA","ects":12,"semester":"HS5","module_type":"pflicht","color":"#db2777"},
    {"name":"Vertiefung 1","code":"VT1","ects":4,"semester":"HS5","module_type":"wahl","color":"#6d28d9"},
    {"name":"Vertiefung 2","code":"VT2","ects":4,"semester":"FS6","module_type":"wahl","color":"#6d28d9"}
  ]'::jsonb
);

INSERT INTO studiengaenge (name, fh, abschluss, semester_count, ects_total, modules_json)
VALUES (
  'Informatik BSc', 'FFHS', 'BSc', 6, 180,
  '[
    {"name":"Mathematik 1","code":"MAT1","ects":4,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
    {"name":"Programmieren 1","code":"PRG1","ects":4,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
    {"name":"Grundlagen Informatik","code":"GRI","ects":4,"semester":"HS1","module_type":"pflicht","color":"#059669"},
    {"name":"Datenbanken 1","code":"DB1","ects":4,"semester":"HS1","module_type":"pflicht","color":"#dc2626"},
    {"name":"Mathematik 2","code":"MAT2","ects":4,"semester":"FS2","module_type":"pflicht","color":"#6d28d9"},
    {"name":"Programmieren 2","code":"PRG2","ects":4,"semester":"FS2","module_type":"pflicht","color":"#2563eb"},
    {"name":"Algorithmen & Datenstrukturen","code":"ADS","ects":4,"semester":"FS2","module_type":"pflicht","color":"#d97706"},
    {"name":"Betriebssysteme","code":"BS","ects":4,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
    {"name":"Software Engineering","code":"SE","ects":4,"semester":"HS3","module_type":"pflicht","color":"#2563eb"},
    {"name":"Netzwerke","code":"NET","ects":4,"semester":"HS3","module_type":"pflicht","color":"#dc2626"},
    {"name":"Web-Technologien","code":"WEB","ects":4,"semester":"HS3","module_type":"pflicht","color":"#059669"},
    {"name":"Statistik","code":"STAT","ects":4,"semester":"HS3","module_type":"pflicht","color":"#6d28d9"},
    {"name":"Verteilte Systeme","code":"VS","ects":4,"semester":"FS4","module_type":"pflicht","color":"#d97706"},
    {"name":"IT-Sicherheit","code":"ITS","ects":4,"semester":"FS4","module_type":"pflicht","color":"#dc2626"},
    {"name":"Machine Learning","code":"ML","ects":4,"semester":"FS4","module_type":"pflicht","color":"#2563eb"},
    {"name":"Bachelor-Thesis","code":"BA","ects":12,"semester":"HS5","module_type":"pflicht","color":"#db2777"},
    {"name":"Vertiefung 1","code":"VT1","ects":4,"semester":"HS5","module_type":"wahl","color":"#6d28d9"},
    {"name":"Vertiefung 2","code":"VT2","ects":4,"semester":"FS6","module_type":"wahl","color":"#6d28d9"}
  ]'::jsonb
);

INSERT INTO studiengaenge (name, fh, abschluss, semester_count, ects_total, modules_json)
VALUES (
  'Betriebsökonomie BSc', 'FFHS', 'BSc', 6, 180,
  '[
    {"name":"Betriebswirtschaft 1","code":"BWL1","ects":4,"semester":"HS1","module_type":"pflicht","color":"#d97706"},
    {"name":"Rechnungswesen 1","code":"REW1","ects":4,"semester":"HS1","module_type":"pflicht","color":"#059669"},
    {"name":"Recht 1","code":"REC1","ects":4,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
    {"name":"Volkswirtschaft","code":"VWL","ects":4,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
    {"name":"Rechnungswesen 2","code":"REW2","ects":4,"semester":"FS2","module_type":"pflicht","color":"#059669"},
    {"name":"Marketing","code":"MKT","ects":4,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
    {"name":"Personalmanagement","code":"HRM","ects":4,"semester":"HS3","module_type":"pflicht","color":"#6d28d9"},
    {"name":"Finanzen","code":"FIN","ects":4,"semester":"FS4","module_type":"pflicht","color":"#d97706"},
    {"name":"Strategie","code":"STR","ects":4,"semester":"FS4","module_type":"pflicht","color":"#2563eb"},
    {"name":"Bachelor-Thesis","code":"BA","ects":12,"semester":"HS5","module_type":"pflicht","color":"#db2777"}
  ]'::jsonb
);

INSERT INTO studiengaenge (name, fh, abschluss, semester_count, ects_total, modules_json)
VALUES (
  'Data Science BSc', 'FFHS', 'BSc', 6, 180,
  '[
    {"name":"Mathematik & Statistik 1","code":"MS1","ects":4,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
    {"name":"Programmieren (Python)","code":"PY1","ects":4,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
    {"name":"Datenbanken","code":"DB","ects":4,"semester":"HS1","module_type":"pflicht","color":"#dc2626"},
    {"name":"Mathematik & Statistik 2","code":"MS2","ects":4,"semester":"FS2","module_type":"pflicht","color":"#6d28d9"},
    {"name":"Machine Learning Grundlagen","code":"ML1","ects":4,"semester":"FS2","module_type":"pflicht","color":"#059669"},
    {"name":"Data Engineering","code":"DE","ects":4,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
    {"name":"Deep Learning","code":"DL","ects":4,"semester":"HS3","module_type":"pflicht","color":"#2563eb"},
    {"name":"Big Data Technologien","code":"BDT","ects":4,"semester":"FS4","module_type":"pflicht","color":"#dc2626"},
    {"name":"Data Visualization","code":"DV","ects":4,"semester":"FS4","module_type":"pflicht","color":"#059669"},
    {"name":"Bachelor-Thesis","code":"BA","ects":12,"semester":"HS5","module_type":"pflicht","color":"#db2777"}
  ]'::jsonb
);
