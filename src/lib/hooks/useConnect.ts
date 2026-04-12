"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ConnectStudent {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  institution_name: string | null;
  program_name: string | null;
  degree_level: string | null;
  current_semester: number | null;
  study_progress: number | null;
  connect_bio: string | null;
  connect_show_institution: boolean;
  connect_show_semester: boolean;
  connect_show_progress: boolean;
  level: number;
  xp_total: number;
  online_status: string | null;
  connection_status: string | null; // null = no connection, "pending", "accepted"
}

export interface ConnectRequest {
  id: string;
  status: string;
  message: string | null;
  program_match: string | null;
  created_at: string;
  requester?: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    current_semester: number | null;
    level: number;
    online_status: string | null;
  };
  addressee?: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    current_semester: number | null;
    level: number;
    online_status: string | null;
  };
}

export interface ConnectPeer {
  id: string;
  program_match: string | null;
  connected_at: string;
  peer: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    current_semester: number | null;
    level: number;
    online_status: string | null;
    connect_bio: string | null;
  };
}

export interface ConnectCounts {
  total_connections: number;
  pending_received: number;
  pending_sent: number;
}

type ConnectTab = "discover" | "requests" | "connections";

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useConnect() {
  const [tab, setTab] = useState<ConnectTab>("discover");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Discover
  const [students, setStudents] = useState<ConnectStudent[]>([]);

  // Requests
  const [incoming, setIncoming] = useState<ConnectRequest[]>([]);
  const [sent, setSent] = useState<ConnectRequest[]>([]);

  // Connections
  const [connections, setConnections] = useState<ConnectPeer[]>([]);

  // Counts
  const [counts, setCounts] = useState<ConnectCounts>({
    total_connections: 0,
    pending_received: 0,
    pending_sent: 0,
  });

  // ─── Fetch ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tab });
      if (search) params.set("search", search);

      const res = await fetch(`/api/connect?${params}`);
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();

      if (tab === "discover") {
        setStudents(data.students ?? []);
      } else if (tab === "requests") {
        setIncoming(data.incoming ?? []);
        setSent(data.sent ?? []);
      } else if (tab === "connections") {
        setConnections(data.connections ?? []);
      }

      if (data.counts) setCounts(data.counts);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Actions ────────────────────────────────────────────────────────────

  const sendRequest = useCallback(async (targetId: string, message?: string) => {
    setActionLoading(targetId);
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId, message }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler");
      }
      // Optimistic: update the student's connection_status
      setStudents((prev) =>
        prev.map((s) =>
          s.user_id === targetId ? { ...s, connection_status: "pending" } : s
        )
      );
    } finally {
      setActionLoading(null);
    }
  }, []);

  const respondToRequest = useCallback(async (connectionId: string, action: "accept" | "decline" | "block") => {
    setActionLoading(connectionId);
    try {
      const res = await fetch("/api/connect", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, action }),
      });
      if (!res.ok) throw new Error("Fehler");
      // Optimistic: remove from incoming
      setIncoming((prev) => prev.filter((r) => r.id !== connectionId));
      setCounts((prev) => ({
        ...prev,
        pending_received: Math.max(0, prev.pending_received - 1),
        total_connections: action === "accept" ? prev.total_connections + 1 : prev.total_connections,
      }));
    } finally {
      setActionLoading(null);
    }
  }, []);

  const removeConnection = useCallback(async (connectionId: string) => {
    setActionLoading(connectionId);
    try {
      const res = await fetch("/api/connect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      if (!res.ok) throw new Error("Fehler");
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
      setCounts((prev) => ({
        ...prev,
        total_connections: Math.max(0, prev.total_connections - 1),
      }));
    } finally {
      setActionLoading(null);
    }
  }, []);

  const cancelRequest = useCallback(async (connectionId: string) => {
    setActionLoading(connectionId);
    try {
      const res = await fetch("/api/connect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      if (!res.ok) throw new Error("Fehler");
      setSent((prev) => prev.filter((r) => r.id !== connectionId));
      setCounts((prev) => ({
        ...prev,
        pending_sent: Math.max(0, prev.pending_sent - 1),
      }));
    } finally {
      setActionLoading(null);
    }
  }, []);

  return {
    // State
    tab, setTab,
    search, setSearch,
    loading, actionLoading,
    students, incoming, sent, connections, counts,
    // Actions
    sendRequest, respondToRequest, removeConnection, cancelRequest,
    refetch: fetchData,
  };
}
