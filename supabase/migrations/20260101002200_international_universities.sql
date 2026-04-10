-- Migration 022: Add country column + international university programs
-- Adds universities and programs for: CH (extended), DE, AT, FR, IT, NL, ES, UK

-- 1. Add country column
ALTER TABLE studiengaenge ADD COLUMN IF NOT EXISTS country text DEFAULT 'CH';

-- 2. Update existing Swiss programs
UPDATE studiengaenge SET country = 'CH' WHERE country IS NULL OR country = 'CH';

-- ════════════════════════════════════════════════════════════════════
-- SCHWEIZ – Neue FHs: HSLU, FHGR, SUPSI, HSG
-- ════════════════════════════════════════════════════════════════════

INSERT INTO studiengaenge (name, fh, country, abschluss, semester_count, ects_total, modules_json) VALUES
('Informatik', 'HSLU', 'CH', 'BSc', 6, 180, '[
  {"name":"Mathematik 1","code":"HSLU-ICT-01","ects":4,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Mathematik 2","code":"HSLU-ICT-02","ects":4,"semester":"FS2","module_type":"pflicht","color":"#2563eb"},
  {"name":"Programmieren 1","code":"HSLU-ICT-03","ects":4,"semester":"HS1","module_type":"pflicht","color":"#dc2626"},
  {"name":"Programmieren 2","code":"HSLU-ICT-04","ects":4,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Algorithmen & Datenstrukturen","code":"HSLU-ICT-05","ects":4,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Datenbanken","code":"HSLU-ICT-06","ects":4,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Betriebssysteme & Netzwerke","code":"HSLU-ICT-07","ects":4,"semester":"FS2","module_type":"pflicht","color":"#0891b2"},
  {"name":"Webentwicklung","code":"HSLU-ICT-08","ects":4,"semester":"HS3","module_type":"pflicht","color":"#65a30d"},
  {"name":"Software Engineering","code":"HSLU-ICT-09","ects":4,"semester":"FS4","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Machine Learning","code":"HSLU-ICT-10","ects":4,"semester":"HS5","module_type":"wahlpflicht","color":"#2563eb"},
  {"name":"IT Security","code":"HSLU-ICT-11","ects":4,"semester":"FS4","module_type":"pflicht","color":"#dc2626"},
  {"name":"Bachelorarbeit","code":"HSLU-ICT-12","ects":12,"semester":"FS6","module_type":"pflicht","color":"#059669"}
]'),
('Wirtschaftsinformatik', 'HSLU', 'CH', 'BSc', 6, 180, '[
  {"name":"Mathematik für Wirtschaft","code":"HSLU-WI-01","ects":4,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"BWL Grundlagen","code":"HSLU-WI-02","ects":4,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Programmieren","code":"HSLU-WI-03","ects":4,"semester":"HS1","module_type":"pflicht","color":"#dc2626"},
  {"name":"Datenbanken","code":"HSLU-WI-04","ects":4,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Prozessmanagement","code":"HSLU-WI-05","ects":4,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"ERP-Systeme","code":"HSLU-WI-06","ects":4,"semester":"FS4","module_type":"pflicht","color":"#db2777"},
  {"name":"IT-Architektur","code":"HSLU-WI-07","ects":4,"semester":"HS3","module_type":"pflicht","color":"#0891b2"},
  {"name":"Digital Business","code":"HSLU-WI-08","ects":4,"semester":"FS4","module_type":"pflicht","color":"#65a30d"},
  {"name":"Bachelorarbeit","code":"HSLU-WI-09","ects":12,"semester":"FS6","module_type":"pflicht","color":"#6d28d9"}
]'),
('Betriebsökonomie', 'HSLU', 'CH', 'BSc', 6, 180, '[
  {"name":"Rechnungswesen","code":"HSLU-BW-01","ects":4,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Volkswirtschaftslehre","code":"HSLU-BW-02","ects":4,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Marketing","code":"HSLU-BW-03","ects":4,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Statistik","code":"HSLU-BW-04","ects":4,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Unternehmensrecht","code":"HSLU-BW-05","ects":4,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Controlling","code":"HSLU-BW-06","ects":4,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Finanzierung","code":"HSLU-BW-07","ects":4,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Bachelorarbeit","code":"HSLU-BW-08","ects":12,"semester":"FS6","module_type":"pflicht","color":"#65a30d"}
]'),
('Informatik', 'FHGR', 'CH', 'BSc', 6, 180, '[
  {"name":"Mathematik","code":"FHGR-ICT-01","ects":6,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Programmierung 1","code":"FHGR-ICT-02","ects":4,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Programmierung 2","code":"FHGR-ICT-03","ects":4,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Webentwicklung","code":"FHGR-ICT-04","ects":4,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Datenbanken","code":"FHGR-ICT-05","ects":4,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Netzwerke","code":"FHGR-ICT-06","ects":4,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Software Engineering","code":"FHGR-ICT-07","ects":4,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Bachelorarbeit","code":"FHGR-ICT-08","ects":12,"semester":"FS6","module_type":"pflicht","color":"#65a30d"}
]'),
('Mobile Robotics', 'SUPSI', 'CH', 'BSc', 6, 180, '[
  {"name":"Matematica 1","code":"SUPSI-ROB-01","ects":6,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Informatica 1","code":"SUPSI-ROB-02","ects":4,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Fisica","code":"SUPSI-ROB-03","ects":4,"semester":"HS1","module_type":"pflicht","color":"#dc2626"},
  {"name":"Elettronica","code":"SUPSI-ROB-04","ects":4,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Programmazione C/C++","code":"SUPSI-ROB-05","ects":4,"semester":"FS2","module_type":"pflicht","color":"#d97706"},
  {"name":"Robotica","code":"SUPSI-ROB-06","ects":4,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Machine Learning","code":"SUPSI-ROB-07","ects":4,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Tesi di Bachelor","code":"SUPSI-ROB-08","ects":12,"semester":"FS6","module_type":"pflicht","color":"#65a30d"}
]'),
('Ingegneria Informatica', 'SUPSI', 'CH', 'BSc', 6, 180, '[
  {"name":"Matematica 1","code":"SUPSI-ICT-01","ects":6,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Programmazione 1","code":"SUPSI-ICT-02","ects":4,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Architettura dei Calcolatori","code":"SUPSI-ICT-03","ects":4,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Programmazione 2","code":"SUPSI-ICT-04","ects":4,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Basi di Dati","code":"SUPSI-ICT-05","ects":4,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Reti","code":"SUPSI-ICT-06","ects":4,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Ingegneria del Software","code":"SUPSI-ICT-07","ects":4,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Sicurezza Informatica","code":"SUPSI-ICT-08","ects":4,"semester":"FS4","module_type":"pflicht","color":"#65a30d"},
  {"name":"Tesi di Bachelor","code":"SUPSI-ICT-09","ects":12,"semester":"FS6","module_type":"pflicht","color":"#6d28d9"}
]');

-- ════════════════════════════════════════════════════════════════════
-- DEUTSCHLAND (DE)
-- ════════════════════════════════════════════════════════════════════

INSERT INTO studiengaenge (name, fh, country, abschluss, semester_count, ects_total, modules_json) VALUES
('Informatik', 'TH Köln', 'DE', 'BSc', 6, 180, '[
  {"name":"Mathematik 1","code":"THK-INF-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Mathematik 2","code":"THK-INF-02","ects":5,"semester":"FS2","module_type":"pflicht","color":"#2563eb"},
  {"name":"Programmierung 1","code":"THK-INF-03","ects":5,"semester":"HS1","module_type":"pflicht","color":"#dc2626"},
  {"name":"Programmierung 2","code":"THK-INF-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Algorithmen und Datenstrukturen","code":"THK-INF-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Betriebssysteme","code":"THK-INF-06","ects":5,"semester":"FS2","module_type":"pflicht","color":"#db2777"},
  {"name":"Datenbanken","code":"THK-INF-07","ects":5,"semester":"HS3","module_type":"pflicht","color":"#0891b2"},
  {"name":"Rechnernetze","code":"THK-INF-08","ects":5,"semester":"HS3","module_type":"pflicht","color":"#65a30d"},
  {"name":"Softwaretechnik","code":"THK-INF-09","ects":5,"semester":"FS4","module_type":"pflicht","color":"#6d28d9"},
  {"name":"IT-Sicherheit","code":"THK-INF-10","ects":5,"semester":"FS4","module_type":"pflicht","color":"#2563eb"},
  {"name":"Praxisprojekt","code":"THK-INF-11","ects":10,"semester":"HS5","module_type":"pflicht","color":"#dc2626"},
  {"name":"Bachelorarbeit","code":"THK-INF-12","ects":12,"semester":"FS6","module_type":"pflicht","color":"#059669"}
]'),
('Wirtschaftsinformatik', 'TH Köln', 'DE', 'BSc', 6, 180, '[
  {"name":"Mathematik","code":"THK-WI-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"BWL Grundlagen","code":"THK-WI-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Programmierung","code":"THK-WI-03","ects":5,"semester":"HS1","module_type":"pflicht","color":"#dc2626"},
  {"name":"Datenbanken","code":"THK-WI-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"ERP-Systeme","code":"THK-WI-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Geschäftsprozessmanagement","code":"THK-WI-06","ects":5,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"IT-Projektmanagement","code":"THK-WI-07","ects":5,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Bachelorarbeit","code":"THK-WI-08","ects":12,"semester":"FS6","module_type":"pflicht","color":"#65a30d"}
]'),
('Betriebswirtschaftslehre', 'TH Köln', 'DE', 'BSc', 6, 180, '[
  {"name":"Rechnungswesen","code":"THK-BWL-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Volkswirtschaftslehre","code":"THK-BWL-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Marketing","code":"THK-BWL-03","ects":5,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Statistik","code":"THK-BWL-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Wirtschaftsrecht","code":"THK-BWL-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Controlling","code":"THK-BWL-06","ects":5,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Unternehmensführung","code":"THK-BWL-07","ects":5,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Bachelorarbeit","code":"THK-BWL-08","ects":12,"semester":"FS6","module_type":"pflicht","color":"#65a30d"}
]'),
('Wirtschaftsingenieurwesen', 'TH Köln', 'DE', 'BSc', 7, 210, '[
  {"name":"Mathematik 1","code":"THK-WING-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Physik","code":"THK-WING-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Technische Mechanik","code":"THK-WING-03","ects":5,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"BWL Grundlagen","code":"THK-WING-04","ects":5,"semester":"HS1","module_type":"pflicht","color":"#059669"},
  {"name":"Produktionsmanagement","code":"THK-WING-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Supply Chain Management","code":"THK-WING-06","ects":5,"semester":"FS4","module_type":"pflicht","color":"#db2777"},
  {"name":"Qualitätsmanagement","code":"THK-WING-07","ects":5,"semester":"HS5","module_type":"pflicht","color":"#0891b2"},
  {"name":"Bachelorarbeit","code":"THK-WING-08","ects":12,"semester":"HS7","module_type":"pflicht","color":"#65a30d"}
]'),
('Informatik', 'HAW Hamburg', 'DE', 'BSc', 6, 180, '[
  {"name":"Mathematik 1","code":"HAW-INF-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Programmieren 1 (Java)","code":"HAW-INF-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Mathematik 2","code":"HAW-INF-03","ects":5,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Programmieren 2","code":"HAW-INF-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Algorithmen und Datenstrukturen","code":"HAW-INF-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Datenbanken","code":"HAW-INF-06","ects":5,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Verteilte Systeme","code":"HAW-INF-07","ects":5,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Software Engineering","code":"HAW-INF-08","ects":5,"semester":"FS4","module_type":"pflicht","color":"#65a30d"},
  {"name":"Bachelorarbeit","code":"HAW-INF-09","ects":12,"semester":"FS6","module_type":"pflicht","color":"#6d28d9"}
]'),
('Informatik', 'DHBW', 'DE', 'BSc', 6, 180, '[
  {"name":"Mathematik 1","code":"DHBW-INF-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Programmieren 1","code":"DHBW-INF-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Theoretische Informatik","code":"DHBW-INF-03","ects":5,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Programmieren 2","code":"DHBW-INF-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Datenbanken","code":"DHBW-INF-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Webentwicklung","code":"DHBW-INF-06","ects":5,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Software Engineering","code":"DHBW-INF-07","ects":5,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Praxisprojekt","code":"DHBW-INF-08","ects":10,"semester":"HS5","module_type":"pflicht","color":"#65a30d"},
  {"name":"Bachelorarbeit","code":"DHBW-INF-09","ects":12,"semester":"FS6","module_type":"pflicht","color":"#6d28d9"}
]'),
('Informatik', 'FH Aachen', 'DE', 'BSc', 6, 180, '[
  {"name":"Mathematik 1","code":"FHA-INF-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Programmierung 1","code":"FHA-INF-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Grundlagen der Informatik","code":"FHA-INF-03","ects":5,"semester":"HS1","module_type":"pflicht","color":"#dc2626"},
  {"name":"Programmierung 2","code":"FHA-INF-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Algorithmen","code":"FHA-INF-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Datenbanken","code":"FHA-INF-06","ects":5,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Betriebssysteme","code":"FHA-INF-07","ects":5,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Bachelorarbeit","code":"FHA-INF-08","ects":12,"semester":"FS6","module_type":"pflicht","color":"#65a30d"}
]'),
('Medieninformatik', 'TH Köln', 'DE', 'BSc', 6, 180, '[
  {"name":"Mathematik","code":"THK-MI-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Einführung in die Medieninformatik","code":"THK-MI-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Programmierung 1","code":"THK-MI-03","ects":5,"semester":"HS1","module_type":"pflicht","color":"#dc2626"},
  {"name":"Web Development","code":"THK-MI-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Mensch-Computer-Interaktion","code":"THK-MI-05","ects":5,"semester":"FS2","module_type":"pflicht","color":"#d97706"},
  {"name":"Mediendesign","code":"THK-MI-06","ects":5,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Audiovisuelle Medien","code":"THK-MI-07","ects":5,"semester":"HS3","module_type":"pflicht","color":"#0891b2"},
  {"name":"Bachelorarbeit","code":"THK-MI-08","ects":12,"semester":"FS6","module_type":"pflicht","color":"#65a30d"}
]');

-- ════════════════════════════════════════════════════════════════════
-- ÖSTERREICH (AT)
-- ════════════════════════════════════════════════════════════════════

INSERT INTO studiengaenge (name, fh, country, abschluss, semester_count, ects_total, modules_json) VALUES
('Informatik', 'FH Technikum Wien', 'AT', 'BSc', 6, 180, '[
  {"name":"Mathematik 1","code":"FHTW-INF-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Programmieren 1","code":"FHTW-INF-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Mathematik 2","code":"FHTW-INF-03","ects":5,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Programmieren 2","code":"FHTW-INF-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Algorithmen und Datenstrukturen","code":"FHTW-INF-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Datenbanken","code":"FHTW-INF-06","ects":5,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Betriebssysteme","code":"FHTW-INF-07","ects":5,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Software Engineering","code":"FHTW-INF-08","ects":5,"semester":"FS4","module_type":"pflicht","color":"#65a30d"},
  {"name":"Netzwerktechnik","code":"FHTW-INF-09","ects":5,"semester":"HS5","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Bachelorarbeit","code":"FHTW-INF-10","ects":12,"semester":"FS6","module_type":"pflicht","color":"#2563eb"}
]'),
('Wirtschaftsinformatik', 'FH Technikum Wien', 'AT', 'BSc', 6, 180, '[
  {"name":"Mathematik","code":"FHTW-WI-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"BWL Grundlagen","code":"FHTW-WI-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Programmierung","code":"FHTW-WI-03","ects":5,"semester":"HS1","module_type":"pflicht","color":"#dc2626"},
  {"name":"Datenbanken","code":"FHTW-WI-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Geschäftsprozessmanagement","code":"FHTW-WI-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"IT-Management","code":"FHTW-WI-06","ects":5,"semester":"FS4","module_type":"pflicht","color":"#db2777"},
  {"name":"Bachelorarbeit","code":"FHTW-WI-07","ects":12,"semester":"FS6","module_type":"pflicht","color":"#0891b2"}
]'),
('Informatik', 'FH Campus Wien', 'AT', 'BSc', 6, 180, '[
  {"name":"Mathematik","code":"FHCW-INF-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Programmieren 1","code":"FHCW-INF-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Programmieren 2","code":"FHCW-INF-03","ects":5,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Datenbanken","code":"FHCW-INF-04","ects":5,"semester":"HS3","module_type":"pflicht","color":"#059669"},
  {"name":"Webentwicklung","code":"FHCW-INF-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Netzwerktechnik","code":"FHCW-INF-06","ects":5,"semester":"FS4","module_type":"pflicht","color":"#db2777"},
  {"name":"Softwareengineering","code":"FHCW-INF-07","ects":5,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Bachelorarbeit","code":"FHCW-INF-08","ects":12,"semester":"FS6","module_type":"pflicht","color":"#65a30d"}
]'),
('Informatik', 'FH Joanneum', 'AT', 'BSc', 6, 180, '[
  {"name":"Mathematik 1","code":"FHJ-INF-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Programmieren 1","code":"FHJ-INF-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Programmieren 2","code":"FHJ-INF-03","ects":5,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Datenbanken","code":"FHJ-INF-04","ects":5,"semester":"HS3","module_type":"pflicht","color":"#059669"},
  {"name":"Software Engineering","code":"FHJ-INF-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Mobile Computing","code":"FHJ-INF-06","ects":5,"semester":"FS4","module_type":"pflicht","color":"#db2777"},
  {"name":"Bachelorarbeit","code":"FHJ-INF-07","ects":12,"semester":"FS6","module_type":"pflicht","color":"#0891b2"}
]'),
('Recht', 'FH Campus Wien', 'AT', 'BA', 6, 180, '[
  {"name":"Einführung in das Recht","code":"FHCW-JUR-01","ects":6,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Privatrecht","code":"FHCW-JUR-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Öffentliches Recht","code":"FHCW-JUR-03","ects":5,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Arbeitsrecht","code":"FHCW-JUR-04","ects":5,"semester":"HS3","module_type":"pflicht","color":"#059669"},
  {"name":"Unternehmensrecht","code":"FHCW-JUR-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Steuerrecht","code":"FHCW-JUR-06","ects":5,"semester":"FS4","module_type":"pflicht","color":"#db2777"},
  {"name":"Bachelorarbeit","code":"FHCW-JUR-07","ects":12,"semester":"FS6","module_type":"pflicht","color":"#0891b2"}
]');

-- ════════════════════════════════════════════════════════════════════
-- FRANKREICH (FR)
-- ════════════════════════════════════════════════════════════════════

INSERT INTO studiengaenge (name, fh, country, abschluss, semester_count, ects_total, modules_json) VALUES
('Informatique', 'IUT Paris', 'FR', 'BUT', 6, 180, '[
  {"name":"Mathématiques discrètes","code":"IUT-INF-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Introduction à la programmation","code":"IUT-INF-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Architecture des ordinateurs","code":"IUT-INF-03","ects":5,"semester":"HS1","module_type":"pflicht","color":"#dc2626"},
  {"name":"Programmation orientée objet","code":"IUT-INF-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Bases de données","code":"IUT-INF-05","ects":5,"semester":"FS2","module_type":"pflicht","color":"#d97706"},
  {"name":"Développement web","code":"IUT-INF-06","ects":5,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Réseaux","code":"IUT-INF-07","ects":5,"semester":"HS3","module_type":"pflicht","color":"#0891b2"},
  {"name":"Génie logiciel","code":"IUT-INF-08","ects":5,"semester":"FS4","module_type":"pflicht","color":"#65a30d"},
  {"name":"Stage et projet","code":"IUT-INF-09","ects":10,"semester":"FS6","module_type":"pflicht","color":"#6d28d9"}
]'),
('Informatique', 'INSA Lyon', 'FR', 'Diplôme Ingénieur', 10, 300, '[
  {"name":"Mathématiques 1","code":"INSA-INF-01","ects":6,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Physique","code":"INSA-INF-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Algorithmique","code":"INSA-INF-03","ects":5,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Programmation C","code":"INSA-INF-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Systèmes d''exploitation","code":"INSA-INF-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Bases de données","code":"INSA-INF-06","ects":5,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Génie logiciel","code":"INSA-INF-07","ects":5,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Intelligence artificielle","code":"INSA-INF-08","ects":5,"semester":"HS5","module_type":"pflicht","color":"#65a30d"},
  {"name":"Projet de fin d''études","code":"INSA-INF-09","ects":15,"semester":"FS10","module_type":"pflicht","color":"#6d28d9"}
]'),
('Gestion des Entreprises et Administrations', 'IUT Paris', 'FR', 'BUT', 6, 180, '[
  {"name":"Comptabilité","code":"IUT-GEA-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Économie","code":"IUT-GEA-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Droit","code":"IUT-GEA-03","ects":5,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Marketing","code":"IUT-GEA-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Gestion financière","code":"IUT-GEA-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Contrôle de gestion","code":"IUT-GEA-06","ects":5,"semester":"FS4","module_type":"pflicht","color":"#db2777"},
  {"name":"Stage","code":"IUT-GEA-07","ects":10,"semester":"FS6","module_type":"pflicht","color":"#0891b2"}
]'),
('Informatique', 'École 42', 'FR', 'Titre RNCP', 6, 180, '[
  {"name":"Piscine C","code":"42-INF-01","ects":10,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Libft / Get Next Line","code":"42-INF-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"ft_printf","code":"42-INF-03","ects":5,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Minishell","code":"42-INF-04","ects":10,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Philosophers","code":"42-INF-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"ft_containers","code":"42-INF-06","ects":5,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"ft_transcendence","code":"42-INF-07","ects":15,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Specialization","code":"42-INF-08","ects":10,"semester":"HS5","module_type":"wahlpflicht","color":"#65a30d"}
]');

-- ════════════════════════════════════════════════════════════════════
-- ITALIEN (IT)
-- ════════════════════════════════════════════════════════════════════

INSERT INTO studiengaenge (name, fh, country, abschluss, semester_count, ects_total, modules_json) VALUES
('Ingegneria Informatica', 'Politecnico di Milano', 'IT', 'Laurea', 6, 180, '[
  {"name":"Analisi Matematica 1","code":"POLIMI-INF-01","ects":10,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Fondamenti di Informatica","code":"POLIMI-INF-02","ects":10,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Fisica 1","code":"POLIMI-INF-03","ects":10,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Algoritmi e Strutture Dati","code":"POLIMI-INF-04","ects":10,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Basi di Dati","code":"POLIMI-INF-05","ects":10,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Reti di Calcolatori","code":"POLIMI-INF-06","ects":10,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Ingegneria del Software","code":"POLIMI-INF-07","ects":10,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Prova Finale","code":"POLIMI-INF-08","ects":3,"semester":"FS6","module_type":"pflicht","color":"#65a30d"}
]'),
('Informatica', 'Sapienza Roma', 'IT', 'Laurea', 6, 180, '[
  {"name":"Calcolo 1","code":"SAP-INF-01","ects":9,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Programmazione 1","code":"SAP-INF-02","ects":9,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Algebra","code":"SAP-INF-03","ects":9,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Programmazione 2","code":"SAP-INF-04","ects":9,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Basi di Dati","code":"SAP-INF-05","ects":9,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Sistemi Operativi","code":"SAP-INF-06","ects":9,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Reti","code":"SAP-INF-07","ects":9,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Prova Finale","code":"SAP-INF-08","ects":6,"semester":"FS6","module_type":"pflicht","color":"#65a30d"}
]'),
('Economia e Commercio', 'Università di Bologna', 'IT', 'Laurea', 6, 180, '[
  {"name":"Economia Politica","code":"UNIBO-EC-01","ects":9,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Matematica Generale","code":"UNIBO-EC-02","ects":9,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Ragioneria","code":"UNIBO-EC-03","ects":9,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Diritto Privato","code":"UNIBO-EC-04","ects":9,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Statistica","code":"UNIBO-EC-05","ects":9,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Marketing","code":"UNIBO-EC-06","ects":9,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Prova Finale","code":"UNIBO-EC-07","ects":6,"semester":"FS6","module_type":"pflicht","color":"#0891b2"}
]'),
('Giurisprudenza', 'Sapienza Roma', 'IT', 'Laurea Magistrale', 10, 300, '[
  {"name":"Diritto Privato","code":"SAP-LAW-01","ects":12,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Diritto Costituzionale","code":"SAP-LAW-02","ects":12,"semester":"FS2","module_type":"pflicht","color":"#2563eb"},
  {"name":"Diritto Penale","code":"SAP-LAW-03","ects":12,"semester":"HS3","module_type":"pflicht","color":"#dc2626"},
  {"name":"Diritto Commerciale","code":"SAP-LAW-04","ects":9,"semester":"FS4","module_type":"pflicht","color":"#059669"},
  {"name":"Diritto del Lavoro","code":"SAP-LAW-05","ects":9,"semester":"HS5","module_type":"pflicht","color":"#d97706"},
  {"name":"Tesi di Laurea","code":"SAP-LAW-06","ects":18,"semester":"FS10","module_type":"pflicht","color":"#db2777"}
]');

-- ════════════════════════════════════════════════════════════════════
-- NIEDERLANDE (NL)
-- ════════════════════════════════════════════════════════════════════

INSERT INTO studiengaenge (name, fh, country, abschluss, semester_count, ects_total, modules_json) VALUES
('Informatica', 'HvA Amsterdam', 'NL', 'BSc', 8, 240, '[
  {"name":"Programming","code":"HVA-INF-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Databases","code":"HVA-INF-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Web Development","code":"HVA-INF-03","ects":5,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Algorithms","code":"HVA-INF-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Software Engineering","code":"HVA-INF-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Networking","code":"HVA-INF-06","ects":5,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Cloud Computing","code":"HVA-INF-07","ects":5,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Stage","code":"HVA-INF-08","ects":30,"semester":"HS5","module_type":"pflicht","color":"#65a30d"},
  {"name":"Afstuderen","code":"HVA-INF-09","ects":30,"semester":"FS8","module_type":"pflicht","color":"#6d28d9"}
]'),
('Bedrijfskunde', 'HvA Amsterdam', 'NL', 'BSc', 8, 240, '[
  {"name":"Management & Organisatie","code":"HVA-BK-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Marketing","code":"HVA-BK-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Financieel Management","code":"HVA-BK-03","ects":5,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Recht","code":"HVA-BK-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"HRM","code":"HVA-BK-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Stage","code":"HVA-BK-06","ects":30,"semester":"HS5","module_type":"pflicht","color":"#db2777"},
  {"name":"Afstuderen","code":"HVA-BK-07","ects":30,"semester":"FS8","module_type":"pflicht","color":"#0891b2"}
]'),
('Informatica', 'Fontys', 'NL', 'BSc', 8, 240, '[
  {"name":"Object Oriented Programming","code":"FON-INF-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Databases","code":"FON-INF-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Web & Mobile","code":"FON-INF-03","ects":5,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Software Architecture","code":"FON-INF-04","ects":5,"semester":"HS3","module_type":"pflicht","color":"#059669"},
  {"name":"DevOps","code":"FON-INF-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"AI & Data","code":"FON-INF-06","ects":5,"semester":"FS4","module_type":"pflicht","color":"#db2777"},
  {"name":"Stage","code":"FON-INF-07","ects":30,"semester":"HS5","module_type":"pflicht","color":"#0891b2"},
  {"name":"Afstuderen","code":"FON-INF-08","ects":30,"semester":"FS8","module_type":"pflicht","color":"#65a30d"}
]');

-- ════════════════════════════════════════════════════════════════════
-- SPANIEN (ES)
-- ════════════════════════════════════════════════════════════════════

INSERT INTO studiengaenge (name, fh, country, abschluss, semester_count, ects_total, modules_json) VALUES
('Ingeniería Informática', 'UPM Madrid', 'ES', 'Grado', 8, 240, '[
  {"name":"Cálculo","code":"UPM-INF-01","ects":6,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Programación","code":"UPM-INF-02","ects":6,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Álgebra Lineal","code":"UPM-INF-03","ects":6,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Estructuras de Datos","code":"UPM-INF-04","ects":6,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Bases de Datos","code":"UPM-INF-05","ects":6,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Redes de Computadores","code":"UPM-INF-06","ects":6,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Ingeniería del Software","code":"UPM-INF-07","ects":6,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Inteligencia Artificial","code":"UPM-INF-08","ects":6,"semester":"HS5","module_type":"pflicht","color":"#65a30d"},
  {"name":"Trabajo Fin de Grado","code":"UPM-INF-09","ects":12,"semester":"FS8","module_type":"pflicht","color":"#6d28d9"}
]'),
('Administración y Dirección de Empresas', 'UPM Madrid', 'ES', 'Grado', 8, 240, '[
  {"name":"Contabilidad","code":"UPM-ADE-01","ects":6,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Economía","code":"UPM-ADE-02","ects":6,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Matemáticas","code":"UPM-ADE-03","ects":6,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Marketing","code":"UPM-ADE-04","ects":6,"semester":"HS3","module_type":"pflicht","color":"#059669"},
  {"name":"Derecho Empresarial","code":"UPM-ADE-05","ects":6,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Finanzas","code":"UPM-ADE-06","ects":6,"semester":"FS4","module_type":"pflicht","color":"#db2777"},
  {"name":"Trabajo Fin de Grado","code":"UPM-ADE-07","ects":12,"semester":"FS8","module_type":"pflicht","color":"#0891b2"}
]'),
('Ingeniería Informática', 'UPC Barcelona', 'ES', 'Grado', 8, 240, '[
  {"name":"Càlcul","code":"UPC-INF-01","ects":6,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Programació","code":"UPC-INF-02","ects":6,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Estructures de Dades","code":"UPC-INF-03","ects":6,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Bases de Dades","code":"UPC-INF-04","ects":6,"semester":"HS3","module_type":"pflicht","color":"#059669"},
  {"name":"Xarxes","code":"UPC-INF-05","ects":6,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Enginyeria del Software","code":"UPC-INF-06","ects":6,"semester":"FS4","module_type":"pflicht","color":"#db2777"},
  {"name":"Treball de Fi de Grau","code":"UPC-INF-07","ects":12,"semester":"FS8","module_type":"pflicht","color":"#0891b2"}
]');

-- ════════════════════════════════════════════════════════════════════
-- VEREINIGTES KÖNIGREICH (UK)
-- ════════════════════════════════════════════════════════════════════

INSERT INTO studiengaenge (name, fh, country, abschluss, semester_count, ects_total, modules_json) VALUES
('Computer Science', 'Imperial College', 'UK', 'BSc', 6, 180, '[
  {"name":"Programming in Haskell","code":"IC-CS-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Discrete Mathematics","code":"IC-CS-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Logic","code":"IC-CS-03","ects":5,"semester":"HS1","module_type":"pflicht","color":"#dc2626"},
  {"name":"Object-Oriented Programming","code":"IC-CS-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Algorithms","code":"IC-CS-05","ects":5,"semester":"FS2","module_type":"pflicht","color":"#d97706"},
  {"name":"Databases","code":"IC-CS-06","ects":5,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Operating Systems","code":"IC-CS-07","ects":5,"semester":"HS3","module_type":"pflicht","color":"#0891b2"},
  {"name":"Software Engineering","code":"IC-CS-08","ects":5,"semester":"FS4","module_type":"pflicht","color":"#65a30d"},
  {"name":"Machine Learning","code":"IC-CS-09","ects":5,"semester":"HS5","module_type":"wahlpflicht","color":"#6d28d9"},
  {"name":"Final Year Project","code":"IC-CS-10","ects":15,"semester":"FS6","module_type":"pflicht","color":"#2563eb"}
]'),
('Computer Science', 'University of Manchester', 'UK', 'BSc', 6, 180, '[
  {"name":"Programming 1","code":"UOM-CS-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Mathematics","code":"UOM-CS-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Programming 2","code":"UOM-CS-03","ects":5,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Algorithms and Data Structures","code":"UOM-CS-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Databases","code":"UOM-CS-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Software Engineering","code":"UOM-CS-06","ects":5,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"AI and Machine Learning","code":"UOM-CS-07","ects":5,"semester":"FS4","module_type":"wahlpflicht","color":"#0891b2"},
  {"name":"Dissertation","code":"UOM-CS-08","ects":15,"semester":"FS6","module_type":"pflicht","color":"#65a30d"}
]'),
('Business Management', 'University of Manchester', 'UK', 'BSc', 6, 180, '[
  {"name":"Accounting","code":"UOM-BM-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Economics","code":"UOM-BM-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Marketing","code":"UOM-BM-03","ects":5,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Organisational Behaviour","code":"UOM-BM-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"Finance","code":"UOM-BM-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Strategy","code":"UOM-BM-06","ects":5,"semester":"FS4","module_type":"pflicht","color":"#db2777"},
  {"name":"Dissertation","code":"UOM-BM-07","ects":15,"semester":"FS6","module_type":"pflicht","color":"#0891b2"}
]'),
('Law', 'University of Manchester', 'UK', 'LLB', 6, 180, '[
  {"name":"Contract Law","code":"UOM-LAW-01","ects":5,"semester":"HS1","module_type":"pflicht","color":"#6d28d9"},
  {"name":"Constitutional Law","code":"UOM-LAW-02","ects":5,"semester":"HS1","module_type":"pflicht","color":"#2563eb"},
  {"name":"Criminal Law","code":"UOM-LAW-03","ects":5,"semester":"FS2","module_type":"pflicht","color":"#dc2626"},
  {"name":"Tort Law","code":"UOM-LAW-04","ects":5,"semester":"FS2","module_type":"pflicht","color":"#059669"},
  {"name":"EU Law","code":"UOM-LAW-05","ects":5,"semester":"HS3","module_type":"pflicht","color":"#d97706"},
  {"name":"Land Law","code":"UOM-LAW-06","ects":5,"semester":"HS3","module_type":"pflicht","color":"#db2777"},
  {"name":"Equity & Trusts","code":"UOM-LAW-07","ects":5,"semester":"FS4","module_type":"pflicht","color":"#0891b2"},
  {"name":"Dissertation","code":"UOM-LAW-08","ects":15,"semester":"FS6","module_type":"pflicht","color":"#65a30d"}
]');
