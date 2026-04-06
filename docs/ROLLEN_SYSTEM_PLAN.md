# Semetra Rollen-System — Implementierungsplan

## Aktueller Stand

Das System kennt aktuell 3 Rollen (`builder_role` in `profiles`):
- `platform_admin` — voller Zugriff
- `institution_admin` — Builder-Zugriff auf eigene Institution
- `student` — Standard-User (Default)

Es gibt keine Verifizierung, keine Unterscheidung Student/Non-Student, keine Freischaltung.

---

## Ziel: 4 Rollen-System

| Rolle | Kürzel | Registrierung | Verifizierung | Verwaltung |
|-------|--------|--------------|---------------|------------|
| Admin | `admin` | Manuell vergeben | Keine | Alles: User-Mgmt, Builder, Plugins, Developer, Analytics |
| Institution | `institution` | **Nicht wählbar bei Registrierung** — persönliche Kontaktaufnahme + Erstgespräch nötig | Admin-Freischaltung nach persönlichem Kontakt | Builder (eigene Inst.), Student-Mgmt (eigene), Plugins |
| Student | `student` | Wählbar bei Registrierung | **Email-Domain-Verifizierung** (`@hochschule.ch` etc.) — automatisch oder Admin-Freischaltung | Plugins |
| Non-Student | `non_student` | Wählbar bei Registrierung | Standard Email-Verifizierung (Supabase) | Plugins |

### Wichtige Änderung (06.04.2026)

**Kein Dokumenten-Upload mehr!** Aus datenschutzrechtlichen Gründen (Schweizer DSG / DSGVO) wurde entschieden:

1. **Studentenausweis-Upload komplett entfernt** — stattdessen Email-Domain-Verifizierung
2. **Institutions-Nachweis-Upload komplett entfernt** — stattdessen persönlicher Kontakt mit dem Semetra-Team
3. **Keine Storage-Buckets** für Verifizierungsdokumente nötig
4. **Keine Speicherung** von Ausweisdokumenten oder Identitätsnachweisen

---

## Phase 1: Datenbank & Rollen-Grundlage

### Migration 058: Rollen-Erweiterung

**Profiles-Tabelle erweitern:**
```sql
-- Rolle umbenennen: builder_role → user_role
ALTER TABLE profiles RENAME COLUMN builder_role TO user_role;

-- Neue Spalten
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  verification_status TEXT NOT NULL DEFAULT 'none';
  -- Werte: 'none' | 'pending' | 'verified' | 'rejected'

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  verification_submitted_at TIMESTAMPTZ;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  verification_reviewed_at TIMESTAMPTZ;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  verification_reviewed_by UUID REFERENCES auth.users(id);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  verification_note TEXT; -- Admin-Kommentar bei Ablehnung

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  verified_email_domain TEXT; -- z.B. "zhaw.ch", "fhnw.ch" — gespeicherte Domain für Nachweis
```

**Default-Wert ändern:**
```sql
ALTER TABLE profiles ALTER COLUMN user_role SET DEFAULT 'non_student';
```

**Erlaubte Werte:**
```sql
ALTER TABLE profiles ADD CONSTRAINT check_user_role
  CHECK (user_role IN ('admin', 'institution', 'student', 'non_student'));

ALTER TABLE profiles ADD CONSTRAINT check_verification_status
  CHECK (verification_status IN ('none', 'pending', 'verified', 'rejected'));
```

### Auswirkung auf bestehende Daten

| Alter Wert | Neuer Wert |
|------------|------------|
| `platform_admin` | `admin` |
| `institution_admin` | `institution` |
| `student` | `student` |

```sql
UPDATE profiles SET user_role = 'admin' WHERE user_role = 'platform_admin';
UPDATE profiles SET user_role = 'institution' WHERE user_role = 'institution_admin';
-- student bleibt student
-- Alle bestehenden bekommen verification_status = 'verified' (Bestandsschutz)
UPDATE profiles SET verification_status = 'verified'
  WHERE user_role IN ('admin', 'institution', 'student');
```

---

## Phase 2: Registrierung mit Rollenauswahl

### Neuer Registrierungs-Flow

```
[Registrierung]
     │
     ├─ Schritt 1: Email, Username, Passwort
     │
     ├─ Schritt 2: "Ich bin..."
     │    ├─ 🎓 Student (→ Email-Domain wird geprüft)
     │    │    ├─ Email = @hochschule.ch → Auto-Verifizierung ✅
     │    │    └─ Email = andere → Status "pending", Admin-Freischaltung nötig
     │    │
     │    ├─ 👤 Interessent / Non-Student (→ kein Nachweis nötig)
     │    │
     │    └─ 🏛️ Institution? → Info-Text:
     │         "Institutionen werden persönlich eingerichtet.
     │          Kontaktieren Sie uns unter kontakt@semetra.ch
     │          für ein Erstgespräch."
     │
     ├─ Schritt 3 (nur Student): Institution + Studiengang + Semester wählen
     │
     └─ Fertig → Email-Verifizierung (Supabase)
```

### Account-Status nach Registrierung

| Rolle | Status | Zugriff |
|-------|--------|---------|
| Student (Uni-Email) | `verified` (sofort) | Voller Student-Zugriff inkl. Studiengang-Bindung |
| Student (andere Email) | `pending` | App voll nutzbar (wie Non-Student), aber KEINE Institution/Studiengang-Bindung bis verifiziert |
| Non-Student | `verified` (sofort) | Voller Non-Student Zugriff |
| Institution | — | Nicht über Registrierung möglich |

**Prinzip:** Pendente User können die App sofort nutzen (Module manuell anlegen, Noten, Aufgaben, Timer, etc.) — nur die rollenspezifischen Zusatzfunktionen (Studiengang-Bindung) bleiben gesperrt bis zur Freischaltung.

### Email-Domain-Verifizierung (Student)

Bekannte Hochschul-Domains werden in einer Konfiguration gepflegt:

```typescript
// lib/university-domains.ts
export const KNOWN_UNIVERSITY_DOMAINS: Record<string, string> = {
  "zhaw.ch": "ZHAW",
  "students.zhaw.ch": "ZHAW",
  "fhnw.ch": "FHNW",
  "students.fhnw.ch": "FHNW",
  "ethz.ch": "ETH Zürich",
  "student.ethz.ch": "ETH Zürich",
  "uzh.ch": "Universität Zürich",
  "bfh.ch": "BFH",
  "hslu.ch": "HSLU",
  "fhgr.ch": "FHGR",
  "phzh.ch": "PH Zürich",
  "unibe.ch": "Universität Bern",
  "unisg.ch": "Universität St. Gallen",
  "unifr.ch": "Universität Fribourg",
  "unil.ch": "Universität Lausanne",
  "epfl.ch": "EPFL",
  "unibas.ch": "Universität Basel",
  "unilu.ch": "Universität Luzern",
  "usi.ch": "USI",
  "supsi.ch": "SUPSI",
  "hes-so.ch": "HES-SO",
  // Erweiterbar — Admin kann via Dashboard neue Domains hinzufügen
};

export function getUniversityFromEmail(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;

  // Prüfe exakte Domain und übergeordnete Domain
  if (KNOWN_UNIVERSITY_DOMAINS[domain]) return KNOWN_UNIVERSITY_DOMAINS[domain];

  // Subdomain-Check: students.zhaw.ch → zhaw.ch
  const parts = domain.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join(".");
    if (KNOWN_UNIVERSITY_DOMAINS[parent]) return KNOWN_UNIVERSITY_DOMAINS[parent];
  }

  return null;
}

export function isUniversityEmail(email: string): boolean {
  return getUniversityFromEmail(email) !== null;
}
```

### Institutions-Verifizierung

Institutionen werden **nicht** über die Registrierung erstellt, sondern über persönlichen Kontakt:

1. Institution schreibt an **kontakt@semetra.ch**
2. Erstgespräch wird vereinbart (Video-Call oder persönlich)
3. Admin erstellt/upgradet Account manuell nach dem Gespräch
4. Institution erhält Builder-Zugriff nach Admin-Freischaltung

---

## Phase 3: Verifizierungs-Workflow

### Admin: User-Management erweitern

**Neuer Tab/Bereich:** "Verifizierung"

```
[Admin Panel]
  └─ Verifizierung
       ├─ Pendente Studenten (3)    ← Studenten mit Nicht-Hochschul-Email
       └─ Abgelehnte (0)            ← Historie
```

**Pro Antrag:**
- Profil-Info (Name, Email, gewählte Institution/Studiengang)
- Email-Domain anzeigen (zur Prüfung)
- Buttons: ✅ Freischalten | ❌ Ablehnen (mit Kommentar)

**Kein Dokumenten-Review mehr** — nur noch Email-basierte Prüfung und manuelle Freischaltung.

### Institution: Student-Management

**Neuer Bereich unter Verwaltung:** "Studenten"

```
[Institution Verwaltung]
  └─ Studenten
       ├─ Pendente Studenten (2)    ← Nur eigene Institution
       ├─ Aktive Studenten (47)     ← Übersicht
       └─ Abgelehnte (1)
```

- Institution sieht NUR Studenten die IHRE Institution gewählt haben
- Kann Studenten freischalten oder ablehnen
- Bei Freischaltung: `verification_status = 'verified'`
- Email an Student: "Dein Account wurde freigeschaltet"

### Freischaltungs-Logik

```
Student registriert sich
     │
     ├─ Email = @hochschule.ch?
     │    ├─ JA → verification_status = 'verified' (automatisch!)
     │    │       verified_email_domain = "hochschule.ch"
     │    │
     │    └─ NEIN → verification_status = 'pending'
     │              ├─ Admin kann freischalten
     │              └─ Oder: Student ändert Email auf Uni-Email → Auto-Verifizierung
     │
     └─ Bei Ablehnung:
          └─ verification_status = 'rejected'
          └─ verification_note = "Grund..."
          └─ Hinweis: "Verwende deine Hochschul-Email für automatische Verifizierung"
```

---

## Phase 4: UI pro Rolle

### Profil-Seite Unterschiede

| Element | Admin | Institution | Student | Non-Student |
|---------|-------|-------------|---------|-------------|
| Rollen-Badge | 🔴 Admin | 🏛️ Institution | 🎓 Student | 👤 Non-Student |
| Institution wählen | — | ✅ (nur eigene) | ✅ | ❌ |
| Studiengang wählen | — | ❌ | ✅ | ❌ |
| Semester wählen | — | ❌ | ✅ | ❌ |
| Rolle wechseln | Kann alles | Kann zu Student/Non-Student | Kann zu Non-Student (verliert Inst.-Zugang) | Kann zu Student (Uni-Email nötig) |

### Navigation (Sidebar) pro Rolle

| Bereich | Admin | Institution | Student | Non-Student |
|---------|-------|-------------|---------|-------------|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Module | ✅ | ✅ | ✅ | ✅ |
| Noten | ✅ | ✅ | ✅ | ✅ |
| Aufgaben | ✅ | ✅ | ✅ | ✅ |
| Studienplan | ✅ | ✅ | ✅ | ✅ |
| Timer | ✅ | ✅ | ✅ | ✅ |
| Kalender | ✅ | ✅ | ✅ | ✅ |
| **Verwaltung** | | | | |
| → Academic Builder | ✅ | ✅ (eigene) | ❌ | ❌ |
| → User Management | ✅ | ❌ | ❌ | ❌ |
| → Student Management | ✅ | ✅ (eigene) | ❌ | ❌ |
| → Plugins | ✅ | ✅ | ✅ | ✅ |
| → Developer | ✅ | ✅ | ❌ | ❌ |
| → Admin Panel | ✅ | ❌ | ❌ | ❌ |

### Pending-Status UI

Wenn `verification_status === 'pending'` (Student mit Nicht-Hochschul-Email):

```
┌──────────────────────────────────────────────────────┐
│  ⏳ Verifizierung ausstehend                        │
│                                                      │
│  Tipp: Verwende deine Hochschul-Email               │
│  (@zhaw.ch, @ethz.ch, etc.) für eine sofortige      │
│  Freischaltung. Alternativ prüft ein Admin           │
│  deinen Antrag manuell.                              │
│                                                      │
│  Status: Ausstehend                                  │
│  Eingereicht: 06.04.2026                             │
└──────────────────────────────────────────────────────┘
```

Bei `rejected`:
```
┌──────────────────────────────────────────────────────┐
│  ❌ Verifizierung abgelehnt                         │
│                                                      │
│  Grund: "Email konnte nicht zugeordnet werden"       │
│                                                      │
│  Tipp: Ändere deine Email auf deine Hochschul-       │
│  Adresse für automatische Verifizierung.             │
│                                                      │
│  [Email ändern]                                      │
└──────────────────────────────────────────────────────┘
```

---

## Phase 5: Rollenwechsel

### Regeln

| Von → Nach | Möglich? | Bedingung |
|------------|----------|-----------|
| Non-Student → Student | ✅ | Hochschul-Email nötig (Auto-Verifizierung) oder Admin-Freischaltung |
| Student → Non-Student | ✅ | Sofort, verliert Institutions-Bindung |
| Jeder → Institution | ❌ | Nur über persönlichen Kontakt mit Semetra-Team |
| Institution → Student | ✅ | Hochschul-Email nötig |
| Institution → Non-Student | ✅ | Sofort, verliert Builder-Zugriff |
| Jeder → Admin | ❌ | Nur durch Admin manuell vergeben |

### UI im Profil

```
Aktuelle Rolle: 🎓 Student (verifiziert)

Rolle ändern?
┌─────────────────────────────────────┐
│ 👤 Non-Student werden              │
│    Sofort wirksam. Du verlierst     │
│    die Institutions-Bindung.        │
│                                     │
│ 🏛️ Zur Institution wechseln?      │
│    Kontaktiere uns unter            │
│    kontakt@semetra.ch               │
└─────────────────────────────────────┘
```

---

## Phase 6: API-Änderungen

### Neue/Geänderte Endpoints

```
GET    /api/verification/status       — Eigenen Status abfragen
POST   /api/verification/request      — Verifizierungsantrag einreichen (ohne Dokument)
POST   /api/admin/verify              — Admin: User freischalten/ablehnen
GET    /api/admin/pending             — Admin: Alle pendenten Anträge
GET    /api/institution/students      — Institution: Eigene Studenten
POST   /api/institution/verify        — Institution: Student freischalten
POST   /api/profile/change-role       — Rollenwechsel beantragen
```

### Entfernte Endpoints / Funktionen

```
❌ POST /api/verification/submit (Dokument-Upload)
❌ Supabase Storage Bucket: student-id-docs
❌ Supabase Storage Bucket: institution-proof-docs
```

### Bestehende Endpoints anpassen

```
PATCH  /api/academic/enrollment       — Nur für student + verified
POST   /api/academic/modules          — Template-Create nur für admin + institution
GET    /api/academic/institutions     — Alle (für Student-Auswahl)
```

---

## Implementierungs-Reihenfolge

| Schritt | Was | Geschätzter Aufwand |
|---------|-----|-------------------|
| 1 | Migration 058: DB-Schema (user_role, verification_status, verified_email_domain) | Klein |
| 2 | Migration 060: student_id_url/institution_proof_url entfernen | Klein |
| 3 | university-domains.ts: Bekannte Hochschul-Domains pflegen | Klein |
| 4 | Alle Code-Referenzen von `builder_role` auf `user_role` umstellen | Mittel |
| 5 | useProfile Hook + Types anpassen (4 Rollen, kein Dokument-Upload) | Klein |
| 6 | Navigation/Sidebar für 4 Rollen konfigurieren | Klein |
| 7 | Registrierung: Rollenauswahl + Email-Domain-Check (kein Upload!) | Mittel |
| 8 | Verifizierungs-API (request, status, approve, reject — ohne Dokument) | Mittel |
| 9 | Admin Panel: Verifizierungs-Tab (ohne Dokument-Preview) | Klein |
| 10 | Institution: Student-Management Seite | Mittel |
| 11 | Profil-Seite: Rollen-Badge + rollenspezifische Felder | Klein |
| 12 | Pending-Status Banner (mit Hinweis auf Hochschul-Email) | Klein |
| 13 | Rollenwechsel UI + API | Klein |
| 14 | Email-Benachrichtigungen (Freischaltung, Ablehnung) | Mittel |

---

## Geklärte Entscheidungen

1. **KEIN Dokumenten-Upload**: Aus datenschutzrechtlichen Gründen (Schweizer DSG / DSGVO) werden keine Ausweisdokumente oder Identitätsnachweise gespeichert
2. **Student-Verifizierung**: Über Hochschul-Email-Domain (`@zhaw.ch`, `@ethz.ch`, etc.) — automatisch bei bekannten Domains, manuell durch Admin bei unbekannten
3. **Institution-Verifizierung**: Persönliche Kontaktaufnahme mit dem Semetra-Team (kontakt@semetra.ch) + Erstgespräch — nicht über Registrierung möglich
4. **Pending-User**: Können die App voll nutzen (wie Non-Student), aber keine rollenspezifischen Zusatzfeatures bis verifiziert
5. **Non-Student Features**: Hat vollen Zugriff auf alle Features AUSSER Institution/Studiengang-Auswahl (Module, Noten, Timer etc. voll nutzbar)
6. **Email-Service**: Resend (100 Emails/Tag gratis, moderner API Service)
7. **Rollenauswahl**: Bei Registrierung wählbar (Student / Non-Student), später änderbar (mit Neu-Verifizierung wenn nötig)
8. **Institution nicht bei Registrierung wählbar**: Nur über Admin nach persönlichem Kontakt
