/**
 * Offline Timer — IndexedDB-based timer for offline study tracking
 *
 * Stores timer sessions locally when offline, syncs to Supabase when back online.
 * Uses IndexedDB for reliable client-side persistence.
 */

const DB_NAME = "semetra-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending_sessions";

interface PendingSession {
  id: string;
  moduleId: string | null;
  examId: string | null;
  topicId: string | null;
  taskId: string | null;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  effectiveSeconds: number;
  pauseCount: number;
  totalPauseSeconds: number;
  focusRating: number | null;
  energyLevel: number | null;
  note: string | null;
  sessionType: string;
  synced: boolean;
  createdAt: string;
}

/**
 * Open the IndexedDB database.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("synced", "synced", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a completed timer session to IndexedDB.
 */
export async function saveOfflineSession(session: Omit<PendingSession, "id" | "synced" | "createdAt">): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const entry: PendingSession = {
    ...session,
    id,
    synced: false,
    createdAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all pending (unsynced) sessions.
 */
export async function getPendingSessions(): Promise<PendingSession[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("synced");
    const request = index.getAll(IDBKeyRange.only(false));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Mark a session as synced.
 */
export async function markSessionSynced(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        getReq.result.synced = true;
        store.put(getReq.result);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Delete old synced sessions (cleanup, keep last 50).
 */
export async function cleanupSyncedSessions(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("synced");
    const request = index.getAll(IDBKeyRange.only(true));

    request.onsuccess = () => {
      const synced = request.result as PendingSession[];
      // Keep last 50, delete the rest
      const toDelete = synced
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, Math.max(0, synced.length - 50));

      for (const s of toDelete) {
        store.delete(s.id);
      }

      tx.oncomplete = () => resolve(toDelete.length);
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Sync all pending sessions to Supabase.
 * Returns count of successfully synced sessions.
 */
export async function syncPendingSessions(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingSessions();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const session of pending) {
    try {
      const res = await fetch("/api/timer/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId: session.moduleId,
          examId: session.examId,
          topicId: session.topicId,
          taskId: session.taskId,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          durationSeconds: session.durationSeconds,
          effectiveSeconds: session.effectiveSeconds,
          pauseCount: session.pauseCount,
          totalPauseSeconds: session.totalPauseSeconds,
          focusRating: session.focusRating,
          energyLevel: session.energyLevel,
          note: session.note,
          sessionType: session.sessionType,
        }),
      });

      if (res.ok) {
        await markSessionSynced(session.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++; // Network error — will retry next time
    }
  }

  // Cleanup old synced sessions
  await cleanupSyncedSessions();

  return { synced, failed };
}

/**
 * Check if we're currently online.
 */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * Register online event listener for auto-sync.
 */
export function registerAutoSync(callback?: (result: { synced: number; failed: number }) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = async () => {
    const result = await syncPendingSessions();
    if (result.synced > 0) {
      callback?.(result);
      // Dispatch event for other components to know
      window.dispatchEvent(new CustomEvent("offline-sessions-synced", { detail: result }));
    }
  };

  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}
