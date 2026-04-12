"use client";

import { useState } from "react";
import {
  Search, UserPlus, Users, Inbox, Globe2, GraduationCap,
  Check, X, Loader2, MessageCircle, UserMinus, Clock, Send,
  Sparkles, Building2,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useConnect, type ConnectStudent, type ConnectRequest, type ConnectPeer } from "@/lib/hooks/useConnect";

// ─── Status Dot ──────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string | null }) {
  const colors: Record<string, string> = {
    online: "bg-green-500",
    away: "bg-yellow-500",
    dnd: "bg-red-500",
    offline: "bg-gray-400",
  };
  return (
    <span
      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-surface-800 ${colors[status ?? "offline"] ?? colors.offline}`}
    />
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ url, name, status, size = 44 }: { url?: string | null; name?: string | null; status?: string | null; size?: number }) {
  const initials = (name ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {url ? (
        <img src={url} alt={name ?? ""} className="w-full h-full rounded-full object-cover" />
      ) : (
        <div className="w-full h-full rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-300 font-semibold text-sm">
          {initials}
        </div>
      )}
      {status && <StatusDot status={status} />}
    </div>
  );
}

// ─── Tab Button ──────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, icon: Icon, label, badge }: {
  active: boolean; onClick: () => void; icon: typeof Users; label: string; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-brand-600 text-white shadow-sm"
          : "text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
      }`}
    >
      <Icon size={16} />
      {label}
      {badge != null && badge > 0 && (
        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
          active ? "bg-white/20 text-white" : "bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300"
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── Discovery Card ──────────────────────────────────────────────────────────

function StudentCard({ student, onConnect, loading }: {
  student: ConnectStudent; onConnect: (id: string) => void; loading: boolean;
}) {
  const { t } = useTranslation();
  const alreadySent = student.connection_status === "pending";
  const alreadyConnected = student.connection_status === "accepted";

  return (
    <div className="card p-3 sm:p-4 flex items-start gap-3 sm:gap-4 hover:shadow-md transition-shadow">
      <Avatar url={student.avatar_url} name={student.full_name ?? student.username} status={student.online_status} size={36} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm sm:text-base text-surface-900 dark:text-white truncate">
            {student.full_name || student.username || t("connect.anonymous")}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 font-medium">
            Lv. {student.level}
          </span>
        </div>

        {student.connect_show_institution && student.institution_name && (
          <div className="flex items-center gap-1 text-xs text-surface-500 mt-0.5">
            <Building2 size={12} />
            {student.institution_name}
          </div>
        )}

        <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
          {student.connect_show_semester && student.current_semester && (
            <span className="flex items-center gap-1">
              <GraduationCap size={12} />
              {t("connect.semester")} {student.current_semester}
            </span>
          )}
          {student.connect_show_progress && student.study_progress != null && (
            <span className="flex items-center gap-1">
              <Sparkles size={12} />
              {student.study_progress}% ECTS
            </span>
          )}
        </div>

        {student.connect_bio && (
          <p className="text-xs text-surface-600 dark:text-surface-400 mt-1.5 line-clamp-2">{student.connect_bio}</p>
        )}
      </div>

      <div className="flex-shrink-0">
        {alreadyConnected ? (
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <Check size={14} /> {t("connect.connected")}
          </span>
        ) : alreadySent ? (
          <span className="text-xs text-surface-400 flex items-center gap-1">
            <Clock size={14} /> {t("connect.pending")}
          </span>
        ) : (
          <button
            onClick={() => onConnect(student.user_id)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            {t("connect.connect")}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Request Card ────────────────────────────────────────────────────────────

function RequestCard({ request, direction, onAccept, onDecline, onCancel, loading }: {
  request: ConnectRequest;
  direction: "incoming" | "sent";
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onCancel?: (id: string) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const person = direction === "incoming" ? request.requester : request.addressee;

  return (
    <div className="card p-4 flex items-center gap-4">
      <Avatar url={person?.avatar_url} name={person?.full_name ?? person?.username} status={person?.online_status} />
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-surface-900 dark:text-white truncate block">
          {person?.full_name || person?.username || "?"}
        </span>
        {request.program_match && (
          <span className="text-xs text-surface-500">{request.program_match}</span>
        )}
        {request.message && (
          <p className="text-xs text-surface-600 dark:text-surface-400 mt-1 italic">&ldquo;{request.message}&rdquo;</p>
        )}
        <span className="text-xs text-surface-400 mt-0.5 block">
          {new Date(request.created_at).toLocaleDateString("de-CH")}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {direction === "incoming" ? (
          <>
            <button
              onClick={() => onAccept?.(request.id)}
              disabled={loading}
              className="p-2 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
              title={t("connect.accept")}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </button>
            <button
              onClick={() => onDecline?.(request.id)}
              disabled={loading}
              className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
              title={t("connect.decline")}
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <button
            onClick={() => onCancel?.(request.id)}
            disabled={loading}
            className="text-xs text-surface-400 hover:text-red-500 transition-colors flex items-center gap-1"
          >
            <X size={14} /> {t("connect.cancel")}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Connection Card ─────────────────────────────────────────────────────────

function ConnectionCard({ conn, onMessage, onRemove, loading }: {
  conn: ConnectPeer; onMessage: (id: string) => void; onRemove: (connId: string) => void; loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
      <Avatar url={conn.peer.avatar_url} name={conn.peer.full_name ?? conn.peer.username} status={conn.peer.online_status} />
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-surface-900 dark:text-white truncate block">
          {conn.peer.full_name || conn.peer.username || "?"}
        </span>
        {conn.program_match && (
          <span className="text-xs text-brand-600 dark:text-brand-300">{conn.program_match}</span>
        )}
        {conn.peer.connect_bio && (
          <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">{conn.peer.connect_bio}</p>
        )}
        <span className="text-xs text-surface-400 mt-0.5 block">
          {t("connect.connected_since")} {new Date(conn.connected_at).toLocaleDateString("de-CH")}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onMessage(conn.peer.id)}
          className="p-2 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors"
          title={t("connect.message")}
        >
          <MessageCircle size={16} />
        </button>
        <button
          onClick={() => onRemove(conn.id)}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-surface-400 hover:text-red-500 transition-colors"
          title={t("connect.remove")}
        >
          <UserMinus size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, subtitle }: { icon: typeof Users; title: string; subtitle: string }) {
  return (
    <div className="text-center py-16 px-4">
      <Icon size={48} className="mx-auto text-surface-300 dark:text-surface-600 mb-4" />
      <h3 className="text-lg font-semibold text-surface-700 dark:text-surface-300">{title}</h3>
      <p className="text-sm text-surface-500 mt-1 max-w-md mx-auto">{subtitle}</p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ConnectPage() {
  const { t } = useTranslation();
  const {
    tab, setTab, search, setSearch,
    loading, actionLoading,
    students, incoming, sent, connections, counts,
    sendRequest, respondToRequest, removeConnection, cancelRequest,
  } = useConnect();

  const [messageModal, setMessageModal] = useState<string | null>(null);
  const [connectMessage, setConnectMessage] = useState("");

  const handleConnect = async (targetId: string) => {
    await sendRequest(targetId, connectMessage || undefined);
    setMessageModal(null);
    setConnectMessage("");
  };

  const handleMessage = (userId: string) => {
    window.location.href = `/messages?user=${userId}`;
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Globe2 size={28} className="text-brand-600" />
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
            {t("connect.title")}
          </h1>
        </div>
        <p className="text-sm text-surface-500">
          {t("connect.subtitle")}
        </p>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm flex-wrap">
        <span className="flex items-center gap-1.5 text-surface-600 dark:text-surface-400">
          <Users size={16} className="text-brand-500" />
          <strong>{counts.total_connections}</strong> {t("connect.connections_label")}
        </span>
        {counts.pending_received > 0 && (
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <Inbox size={16} />
            <strong>{counts.pending_received}</strong> {t("connect.new_requests")}
          </span>
        )}
        {counts.pending_sent > 0 && (
          <span className="flex items-center gap-1.5 text-surface-500">
            <Send size={16} />
            <strong>{counts.pending_sent}</strong> {t("connect.sent_label")}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <TabBtn
          active={tab === "discover"}
          onClick={() => setTab("discover")}
          icon={Search}
          label={t("connect.tab_discover")}
        />
        <TabBtn
          active={tab === "requests"}
          onClick={() => setTab("requests")}
          icon={Inbox}
          label={t("connect.tab_requests")}
          badge={counts.pending_received}
        />
        <TabBtn
          active={tab === "connections"}
          onClick={() => setTab("connections")}
          icon={Users}
          label={t("connect.tab_connections")}
          badge={counts.total_connections}
        />
      </div>

      {/* Search (Discover tab only) */}
      {tab === "discover" && (
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder={t("connect.search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-16">
          <Loader2 size={32} className="animate-spin mx-auto text-brand-500 mb-3" />
          <p className="text-sm text-surface-500">{t("connect.loading")}</p>
        </div>
      ) : (
        <>
          {/* Discover */}
          {tab === "discover" && (
            <div className="space-y-3">
              {students.length === 0 ? (
                <EmptyState
                  icon={Globe2}
                  title={t("connect.empty_discover_title")}
                  subtitle={t("connect.empty_discover_subtitle")}
                />
              ) : (
                students.map((s) => (
                  <StudentCard
                    key={s.user_id}
                    student={s}
                    onConnect={(id) => handleConnect(id)}
                    loading={actionLoading === s.user_id}
                  />
                ))
              )}
            </div>
          )}

          {/* Requests */}
          {tab === "requests" && (
            <div className="space-y-6">
              {incoming.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3 flex items-center gap-2">
                    <Inbox size={16} /> {t("connect.incoming_requests")} ({incoming.length})
                  </h3>
                  <div className="space-y-3">
                    {incoming.map((r) => (
                      <RequestCard
                        key={r.id}
                        request={r}
                        direction="incoming"
                        onAccept={(id) => respondToRequest(id, "accept")}
                        onDecline={(id) => respondToRequest(id, "decline")}
                        loading={actionLoading === r.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {sent.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3 flex items-center gap-2">
                    <Send size={16} /> {t("connect.sent_requests")} ({sent.length})
                  </h3>
                  <div className="space-y-3">
                    {sent.map((r) => (
                      <RequestCard
                        key={r.id}
                        request={r}
                        direction="sent"
                        onCancel={(id) => cancelRequest(id)}
                        loading={actionLoading === r.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {incoming.length === 0 && sent.length === 0 && (
                <EmptyState
                  icon={Inbox}
                  title={t("connect.empty_requests_title")}
                  subtitle={t("connect.empty_requests_subtitle")}
                />
              )}
            </div>
          )}

          {/* Connections */}
          {tab === "connections" && (
            <div className="space-y-3">
              {connections.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={t("connect.empty_connections_title")}
                  subtitle={t("connect.empty_connections_subtitle")}
                />
              ) : (
                connections.map((c) => (
                  <ConnectionCard
                    key={c.id}
                    conn={c}
                    onMessage={handleMessage}
                    onRemove={(connId) => removeConnection(connId)}
                    loading={actionLoading === c.id}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Connect-with-message modal */}
      {messageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setMessageModal(null)}>
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-3">{t("connect.send_request")}</h3>
            <textarea
              value={connectMessage}
              onChange={(e) => setConnectMessage(e.target.value)}
              placeholder={t("connect.message_placeholder")}
              rows={3}
              maxLength={280}
              className="w-full p-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-sm resize-none focus:ring-2 focus:ring-brand-500 outline-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setMessageModal(null)}
                className="px-4 py-2 text-sm rounded-lg text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              >
                {t("connect.cancel")}
              </button>
              <button
                onClick={() => handleConnect(messageModal)}
                className="px-4 py-2 text-sm rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors"
              >
                {t("connect.send")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
