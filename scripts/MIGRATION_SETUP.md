# Semetra Migration Setup

## Einmalige Einrichtung (2 Minuten)

### 1. DATABASE_URL in .env.local einfuegen

Oeffne das Supabase Dashboard:
**Settings → Database → Connection string → URI**

Kopiere die URL und fuege sie in `.env.local` ein:

```
DATABASE_URL=postgresql://postgres.glnbdloeffeylfmzviis:[DEIN-PASSWORT]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

### 2. pg Modul installieren

```powershell
cd C:\Users\julij_s2z5eyv\Documents\study-organizer\Semetra\semetra-web
npm install pg
```

### 3. Bereits ausgefuehrte Migrationen registrieren

Fuehre EINMALIG die Seed-Datei im Supabase SQL Editor aus:
- Datei: `supabase/seed_applied_migrations.sql`
- Das registriert Migrationen 001-046 als "already applied"

---

## Taeglicher Workflow

### Alle ausstehenden Migrationen ausfuehren:
```powershell
npm run db:migrate
```

### Status pruefen (was ist applied, was pending):
```powershell
npm run db:migrate:status
```

### Dry-Run (zeigt was laufen wuerde, ohne auszufuehren):
```powershell
npm run db:migrate:dry
```

### Einzelne Migration ausfuehren:
```powershell
node scripts/migrate.mjs --up 074
```

---

## Alternative: Supabase CLI

Falls du die Supabase CLI nutzen willst:

```powershell
# Installation (einmalig)
scoop install supabase
# oder: npm install -g supabase

# Projekt verlinken (einmalig)
supabase link --project-ref glnbdloeffeylfmzviis

# Alle Migrationen pushen
supabase db push

# Status pruefen
supabase migration list
```

---

## Neue Migration erstellen

```powershell
# Datei erstellen (Supabase CLI Weg)
supabase migration new mein_feature_name

# Oder manuell: Erstelle eine Datei in supabase/migrations/
# Format: YYYYMMDDHHMMSS_name.sql
```
