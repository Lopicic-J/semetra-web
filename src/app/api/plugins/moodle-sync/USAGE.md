# Moodle-Sync Plugin Usage Guide

## API Endpoints

Base URL: `/api/plugins/moodle-sync`

All endpoints require valid Supabase authentication (via session cookie).

---

## 1. GET - Check Connection Status

**Endpoint:** `GET /api/plugins/moodle-sync`

**Request:**
```bash
curl -X GET https://semetra.app/api/plugins/moodle-sync
```

**Response (Connected):**
```json
{
  "connected": true,
  "moodle_url": "https://moodle.example.ch",
  "username": "john.doe",
  "site_name": "Example University Moodle",
  "last_sync": 1712396400000,
  "synced_courses": 5
}
```

**Response (Not Connected):**
```json
{
  "connected": false,
  "moodle_url": null,
  "username": null,
  "site_name": null,
  "last_sync": null,
  "synced_courses": 0,
  "message": "Plugin nicht installiert"
}
```

---

## 2. POST action="test" - Test Connection

**Endpoint:** `POST /api/plugins/moodle-sync`

Test the connection without storing credentials. Useful before connecting.

**Request:**
```bash
curl -X POST https://semetra.app/api/plugins/moodle-sync \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test",
    "moodle_url": "https://moodle.example.ch",
    "token": "abc123def456ghi789jkl012"
  }'
```

**Success Response (200):**
```json
{
  "ok": true,
  "site_name": "Example University Moodle",
  "username": "john.doe",
  "message": "Verbindung erfolgreich: Example University Moodle"
}
```

**Error Responses:**
```json
{
  "error": "Ungültige Moodle-URL-Format"
}
```

```json
{
  "error": "Moodle error: Invalid access token"
}
```

---

## 3. POST action="connect" - Connect to Moodle

**Endpoint:** `POST /api/plugins/moodle-sync`

Establish connection and install/update the plugin.

**Request:**
```bash
curl -X POST https://semetra.app/api/plugins/moodle-sync \
  -H "Content-Type: application/json" \
  -d '{
    "action": "connect",
    "moodle_url": "https://moodle.example.ch",
    "token": "abc123def456ghi789jkl012"
  }'
```

**Success Response (201):**
```json
{
  "ok": true,
  "site_name": "Example University Moodle",
  "username": "john.doe",
  "message": "Moodle erfolgreich verbunden: Example University Moodle"
}
```

**Notes:**
- Token is stored in encrypted config (implementation note: implement AES encryption)
- Plugin automatically installed if not present
- Connection validated before storing credentials

---

## 4. POST action="sync" - Sync Courses, Assignments, Grades

**Endpoint:** `POST /api/plugins/moodle-sync`

Trigger full synchronization of courses, assignments, and grades from Moodle.

**Request:**
```bash
curl -X POST https://semetra.app/api/plugins/moodle-sync \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sync"
  }'
```

**Success Response (200):**
```json
{
  "ok": true,
  "courses": 5,
  "assignments": 23,
  "grades": 18,
  "message": "Sync abgeschlossen: 5 Kurse, 23 Aufgaben, 18 Noten"
}
```

**Error Response (No Connection):**
```json
{
  "error": "Moodle nicht verbunden"
}
```

**What Gets Synced:**

1. **Courses** (via `core_enrol_get_users_courses`)
   - Course ID, name, code, description
   - Start/end dates (if set)

2. **Assignments** (via `mod_assign_get_assignments`)
   - Assignment name, due date, max grade
   - Linked to course

3. **Grades** (via `gradereport_user_get_grade_items`)
   - Grade items, current grades, max grades
   - Item type (assignment, quiz, etc.)

**Notes:**
- Full sync may take several seconds (calls Moodle API multiple times)
- Continues on per-course errors (one failure doesn't stop entire sync)
- Updates `last_sync` timestamp on completion
- Idempotent: safe to call multiple times

---

## 5. POST action="disconnect" - Remove Connection

**Endpoint:** `POST /api/plugins/moodle-sync`

Remove stored Moodle connection credentials and disable plugin.

**Request:**
```bash
curl -X POST https://semetra.app/api/plugins/moodle-sync \
  -H "Content-Type: application/json" \
  -d '{
    "action": "disconnect"
  }'
```

**Success Response (200):**
```json
{
  "ok": true,
  "message": "Moodle erfolgreich getrennt"
}
```

**Notes:**
- Clears stored token immediately
- Disables plugin
- GET status will return `connected: false`

---

## Error Codes

| Status | Scenario | Error Message |
|--------|----------|---------------|
| 401 | No auth session | "Nicht autorisiert" |
| 400 | Missing parameters | "Moodle-URL und Token erforderlich" |
| 400 | Invalid URL format | "Ungültige Moodle-URL-Format" |
| 400 | Plugin not installed | "Plugin nicht installiert oder konfiguriert" |
| 401 | Bad token | "Moodle error: Invalid access token" |
| 500 | Database error | "Fehler beim Installieren des Plugins" |
| 500 | Sync failed | "Fehler beim Synchronisieren" |

---

## Getting a Moodle Web Service Token

1. Log into your Moodle instance
2. Go to **Preferences** (user menu in top right)
3. Go to **Security Keys** (under "Web services" section)
4. Find "Create a token"
5. Select "User web service"
6. Click "Create token"
7. Copy the generated token (long string of characters)

**Important:**
- Keep this token secret like a password
- It allows full access to your Moodle account
- You can revoke tokens anytime in your Moodle preferences

---

## Frontend Integration Example

```typescript
// Test connection
async function testMoodleConnection() {
  const response = await fetch('/api/plugins/moodle-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'test',
      moodle_url: 'https://moodle.example.ch',
      token: userToken,
    }),
  });

  return response.json();
}

// Connect
async function connectMoodle() {
  const response = await fetch('/api/plugins/moodle-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'connect',
      moodle_url: 'https://moodle.example.ch',
      token: userToken,
    }),
  });

  return response.json();
}

// Get status
async function getStatus() {
  const response = await fetch('/api/plugins/moodle-sync');
  return response.json();
}

// Sync
async function triggerSync() {
  const response = await fetch('/api/plugins/moodle-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sync' }),
  });

  return response.json();
}

// Disconnect
async function disconnectMoodle() {
  const response = await fetch('/api/plugins/moodle-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'disconnect' }),
  });

  return response.json();
}
```

---

## Data Storage

Connection data stored in `user_plugins` table:

```sql
INSERT INTO user_plugins (user_id, plugin_id, enabled, config)
VALUES (
  'user-uuid',
  'moodle-sync',
  true,
  '{
    "moodle_url": "https://moodle.example.ch",
    "token": "abc123...",
    "username": "john.doe",
    "site_name": "Example University Moodle",
    "last_sync": 1712396400000,
    "synced_courses": [
      { "moodleId": 15, "semetraModuleId": null },
      { "moodleId": 23, "semetraModuleId": null }
    ]
  }'::jsonb
);
```

---

## Moodle API Functions Used

| Function | Purpose |
|----------|---------|
| `core_webservice_get_site_info` | Get site info, test connection |
| `core_enrol_get_users_courses` | Get enrolled courses |
| `mod_assign_get_assignments` | Get assignments in course |
| `gradereport_user_get_grade_items` | Get grades and grade items |
| `core_user_get_users_by_id` | Get user information |

These functions require "Web services - User" capability in Moodle.

---

## Logging

All operations logged to structured logger with namespace `api:moodle-sync`:

```
[INFO] [api:moodle-sync] Moodle connected
[DEBUG] [api:moodle-sync] Fetched Moodle courses
[WARN] [api:moodle-sync] Failed to fetch course details
[ERROR] [api:moodle-sync] handleSync failed
```

View logs in application monitoring/observability platform.
