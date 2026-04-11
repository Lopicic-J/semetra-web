"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/hooks/useProfile";
import { useTranslation } from "@/lib/i18n";
import {
  Shield,
  Users,
  Building2,
  BookOpen,
  Search,
  Loader2,
  Edit2,
  Trash2,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Mail,
  Crown,
  CreditCard,
  Infinity,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Lock,
  Activity,
} from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/Card";

// ── Types ──

interface InstitutionDetail {
  id: string;
  name: string;
  studentCount: number;
  adminCount: number;
  activeCount: number;
}

interface StatsData {
  total_users: number;
  total_institutions?: number;
  total_programs: number;
  total_modules?: number;
  pro_users: number;
  lifetime_users?: number;
  subscription_users?: number;
  active_users?: number;
  role: "admin" | "institution";
  institution_names?: string[];
  institution_details?: InstitutionDetail[];
}

interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  user_role: "admin" | "institution" | "student" | "non_student";
  verification_status: "none" | "pending" | "verified" | "rejected";
  plan: "free" | "pro";
  plan_type: "free" | "subscription" | "lifetime" | null;
  plan_tier: "basic" | "full" | null;
  stripe_subscription_status: string | null;
  plan_expires_at: string | null;
  created_at: string | null;
  institution_id: string | null;
  last_seen_at: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface InstitutionAdminData {
  id: string;
  user_id: string;
  institution_id: string;
  user_email: string;
  user_name: string | null;
  institution_name: string;
}

interface VerificationRequest {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  user_role: string;
  verification_status: string;
  verification_submitted_at: string | null;
  verification_note: string | null;
  verified_email_domain: string | null;
  university: string | null;
  created_at: string;
}

interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  created_at: string;
  user_email: string;
  user_name: string | null;
}

// ── Constants ──

const SUPER_ADMIN_EMAIL = "support@semetra.ch";
const ACTIVE_THRESHOLD_MIN = 15;
const PAGE_SIZE = 15;

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  institution: "Institutions-Admin",
  student: "Student",
  non_student: "Non-Student",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  institution: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  student: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  non_student: "bg-surface-200 text-surface-900 dark:bg-surface-700 dark:text-surface-200",
};

const VERIFICATION_BADGES: Record<string, { label: string; className: string } | null> = {
  none: null,
  pending: { label: "Ausstehend", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  verified: { label: "Verifiziert", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  rejected: { label: "Abgelehnt", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

// ── Helpers ──

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ACTIVE_THRESHOLD_MIN * 60 * 1000;
}

// ── Main Component ──

export default function AdminPage() {
  const router = useRouter();
  const { profile, loading: profileLoading, isPlatformAdmin, isInstitution } = useProfile();
  const { t } = useTranslation();

  const hasAccess = isPlatformAdmin || isInstitution;

  // Redirect if no access
  useEffect(() => {
    if (!profileLoading && !hasAccess) {
      router.push("/dashboard");
    }
  }, [profileLoading, hasAccess, router]);

  // ── State ──
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [users, setUsers] = useState<UserData[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersSearch, setUsersSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState<Pagination | null>(null);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string>("non_student");

  const [editingPlanUserId, setEditingPlanUserId] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<"free" | "pro">("free");
  const [editingPlanType, setEditingPlanType] = useState<"free" | "subscription" | "lifetime">("free");
  const [editingPlanTier, setEditingPlanTier] = useState<"basic" | "full">("basic");

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Client-side pagination
  const [instPage, setInstPage] = useState(1);
  const [instAdminPage, setInstAdminPage] = useState(1);

  // Platform-admin only sections
  const [institutionAdmins, setInstitutionAdmins] = useState<InstitutionAdminData[]>([]);
  const [institutionAdminsLoading, setInstitutionAdminsLoading] = useState(true);
  const [verificationQueue, setVerificationQueue] = useState<VerificationRequest[]>([]);
  const [verificationLoading, setVerificationLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  // ── Data Fetching ──

  useEffect(() => {
    if (!hasAccess) return;
    (async () => {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) throw new Error();
        setStats(await res.json());
      } catch { toast.error("Statistiken konnten nicht geladen werden"); }
      finally { setStatsLoading(false); }
    })();
  }, [hasAccess]);

  const fetchUsers = useCallback(async (page = 1) => {
    try {
      setUsersLoading(true);
      const url = new URL("/api/admin/users", window.location.origin);
      if (usersSearch) url.searchParams.set("q", usersSearch);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(PAGE_SIZE));
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUsers(data.users || []);
      setUserPagination(data.pagination || null);
    } catch { toast.error("Benutzer konnten nicht geladen werden"); }
    finally { setUsersLoading(false); }
  }, [usersSearch]);

  useEffect(() => { if (hasAccess) fetchUsers(userPage); }, [hasAccess, fetchUsers, userPage]);

  // Reset to page 1 on search change
  useEffect(() => { setUserPage(1); }, [usersSearch]);

  // Platform-admin-only fetches
  const fetchVerificationQueue = useCallback(async () => {
    try {
      setVerificationLoading(true);
      const res = await fetch("/api/admin/verification?status=pending");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVerificationQueue(data.users || []);
    } catch { toast.error("Verifizierungen konnten nicht geladen werden"); }
    finally { setVerificationLoading(false); }
  }, []);

  useEffect(() => {
    if (!isPlatformAdmin) return;
    fetchVerificationQueue();
    (async () => {
      try {
        const res = await fetch("/api/admin/institution-admins");
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setInstitutionAdmins(data.assignments || []);
      } catch (err) { toast.error(`Institutions-Admins: ${err instanceof Error ? err.message : "Ladefehler"}`); }
      finally { setInstitutionAdminsLoading(false); }
    })();
    (async () => {
      try {
        const res = await fetch("/api/admin/audit-log");
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setAuditLog(data.entries || []);
      } catch (err) { toast.error(`Audit-Log: ${err instanceof Error ? err.message : "Ladefehler"}`); }
      finally { setAuditLoading(false); }
    })();
  }, [isPlatformAdmin, fetchVerificationQueue]);

  // ── Handlers ──

  const handleVerification = async (userId: string, action: "approve" | "reject", note?: string) => {
    setProcessingId(userId);
    try {
      const res = await fetch("/api/admin/verification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, action, note }),
      });
      if (!res.ok) throw new Error();
      toast.success(action === "approve" ? "Verifizierung genehmigt" : "Verifizierung abgelehnt");
      fetchVerificationQueue();
    } catch { toast.error("Fehler bei der Verarbeitung"); }
    finally { setProcessingId(null); }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, user_role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Rolle konnte nicht aktualisiert werden");
      }
      toast.success("Rolle aktualisiert");
      setEditingUserId(null);
      fetchUsers(userPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    }
  };

  const handleUpdatePlan = async (userId: string) => {
    try {
      const updates: Record<string, unknown> = {
        user_id: userId,
        plan: editingPlan,
        plan_type: editingPlan === "free" ? "free" : editingPlanType,
        plan_tier: editingPlan === "free" ? null : editingPlanTier,
        plan_expires_at: editingPlan === "pro" && editingPlanType === "subscription"
          ? new Date(Date.now() + 365 * 86400000).toISOString()
          : null,
      };
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Plan konnte nicht aktualisiert werden");
      }
      toast.success("Plan aktualisiert");
      setEditingPlanUserId(null);
      fetchUsers(userPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    }
  };

  const handleQuickGrantPro = async (
    userId: string,
    type: "subscription" | "lifetime",
    tier: "basic" | "full",
  ) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          plan: "pro",
          plan_type: type,
          plan_tier: tier,
          plan_expires_at: type === "lifetime"
            ? null
            : new Date(Date.now() + 365 * 86400000).toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Fehler");
      }
      toast.success(`Pro ${type === "lifetime" ? "Lifetime" : "Abo"} (${tier}) aktiviert`);
      fetchUsers(userPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    }
  };

  const handleRevokePro = async (userId: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          plan: "free",
          plan_type: "free",
          plan_tier: null,
          plan_expires_at: null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Fehler");
      }
      toast.success("Pro widerrufen — Benutzer ist jetzt Free");
      fetchUsers(userPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    }
  };

  // ── Loading / Access Guard ──

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!hasAccess) return null;

  // ── Derived ──

  /** Roles the current admin can assign */
  const allowedRoles = isPlatformAdmin
    ? ["admin", "institution", "student", "non_student"]
    : ["institution", "student"];

  /** Can this user be edited by the current admin? */
  const canEditUser = (u: UserData) => {
    if (isPlatformAdmin) return true;
    // Institution admin: cannot touch super admin or other admins
    if (u.email === SUPER_ADMIN_EMAIL) return false;
    if (u.user_role === "admin") return false;
    return true;
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="bg-brand-100 dark:bg-brand-900/30 rounded-xl p-3">
          <Shield className="w-6 h-6 text-brand-600" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-surface-900">
            {isPlatformAdmin ? "Plattform-Administration" : "Institutions-Verwaltung"}
          </h1>
          <p className="text-surface-600 mt-1">
            {isPlatformAdmin
              ? "Verwaltung, Verifizierung und Übersicht — nur für Administratoren"
              : stats?.institution_names?.length
                ? `${stats.institution_names.join(", ")} — Benutzerverwaltung`
                : "Benutzerverwaltung deiner Institution"}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {isPlatformAdmin ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatsCard
              icon={<Users className="w-5 h-5" />}
              label="Benutzer"
              value={stats?.total_users ?? 0}
              loading={statsLoading}
              subtitle={`${stats?.active_users ?? 0} aktiv`}
            />
            <StatsCard icon={<Crown className="w-5 h-5" />} label="Pro-Nutzer" value={stats?.pro_users ?? 0} loading={statsLoading} accent />
            <StatsCard icon={<Building2 className="w-5 h-5" />} label="Institutionen" value={stats?.total_institutions ?? 0} loading={statsLoading} />
            <StatsCard icon={<BookOpen className="w-5 h-5" />} label="Studiengänge" value={stats?.total_programs ?? 0} loading={statsLoading} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <StatsCard icon={<CreditCard className="w-5 h-5" />} label="Abonnements" value={stats?.subscription_users ?? 0} loading={statsLoading} />
            <StatsCard icon={<Infinity className="w-5 h-5" />} label="Lifetime" value={stats?.lifetime_users ?? 0} loading={statsLoading} />
            <StatsCard icon={<BookOpen className="w-5 h-5" />} label="Module" value={stats?.total_modules ?? 0} loading={statsLoading} />
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <StatsCard icon={<Users className="w-5 h-5" />} label="Studierende" value={stats?.total_users ?? 0} loading={statsLoading} />
          <StatsCard icon={<Activity className="w-5 h-5" />} label="Aktive Nutzer" value={stats?.active_users ?? 0} loading={statsLoading} accent />
          <StatsCard icon={<BookOpen className="w-5 h-5" />} label="Studiengänge" value={stats?.total_programs ?? 0} loading={statsLoading} />
        </div>
      )}

      {/* ── Verification Queue (Platform admin only) ── */}
      {isPlatformAdmin && (
        <Card className="bg-surface-100 dark:bg-surface-800">
          <div className="p-6 border-b border-surface-200 dark:border-surface-700">
            <h2 className="text-xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Verifizierungs-Warteschlange
              {verificationQueue.length > 0 && (
                <span className="ml-2 px-2.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 rounded-full text-sm font-semibold">
                  {verificationQueue.length}
                </span>
              )}
            </h2>
          </div>
          <div className="p-6">
            {verificationLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-brand-600" /></div>
            ) : verificationQueue.length === 0 ? (
              <div className="text-center py-8 text-surface-500 dark:text-surface-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500 dark:text-green-400" />
                <p>Keine ausstehenden Verifizierungen</p>
              </div>
            ) : (
              <div className="space-y-4">
                {verificationQueue.map((req) => (
                  <div key={req.id} className="bg-[rgb(var(--card-bg))] dark:bg-surface-700 rounded-lg border border-surface-200 dark:border-surface-600 p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-surface-900 dark:text-surface-50 truncate">{req.full_name || req.username || req.email}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ROLE_COLORS[req.user_role] || ROLE_COLORS.non_student}`}>
                            {ROLE_LABELS[req.user_role] || req.user_role}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-surface-500 dark:text-surface-400">
                          <Mail className="w-3.5 h-3.5" />{req.email}
                        </div>
                        {req.university && <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">{req.university}</p>}
                        <p className="text-[10px] text-surface-400 dark:text-surface-500 mt-1">
                          Domain: <span className="font-mono">{req.email.split("@")[1] || "?"}</span>
                        </p>
                      </div>
                      <div className="flex w-full sm:w-auto items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleVerification(req.id, "approve")}
                          disabled={processingId === req.id}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition disabled:opacity-50"
                        >
                          {processingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Genehmigen
                        </button>
                        <button
                          onClick={() => {
                            const note = prompt("Ablehnungsgrund (optional):");
                            if (note !== null) handleVerification(req.id, "reject", note || undefined);
                          }}
                          disabled={processingId === req.id}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />Ablehnen
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── User Management ── */}
      <Card className="bg-surface-100 dark:bg-surface-800">
        <div className="p-6 border-b border-surface-200 dark:border-surface-700">
          <h2 className="text-xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-600" />
            Benutzerverwaltung
          </h2>
          <p className="text-surface-600 dark:text-surface-400 text-sm mt-1">
            {isPlatformAdmin
              ? "Rollen und Abo-Pläne aller Benutzer verwalten"
              : "Studierende deiner Institution verwalten"}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-surface-500 dark:text-surface-400" />
            <input
              type="text"
              placeholder="Nach E-Mail oder Name suchen..."
              value={usersSearch}
              onChange={(e) => setUsersSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-[rgb(var(--card-bg))] dark:bg-surface-700 text-surface-900 dark:text-surface-50 placeholder-surface-500 dark:placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600"
            />
          </div>

          {/* Users List */}
          {usersLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-brand-600" /></div>
          ) : users.length === 0 ? (
            <p className="text-center text-surface-600 dark:text-surface-400 py-8">Keine Benutzer gefunden</p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isPlatformAdmin={isPlatformAdmin}
                  canEdit={canEditUser(user)}
                  allowedRoles={allowedRoles}
                  expandedUserId={expandedUserId}
                  setExpandedUserId={setExpandedUserId}
                  editingUserId={editingUserId}
                  setEditingUserId={setEditingUserId}
                  editingRole={editingRole}
                  setEditingRole={setEditingRole}
                  editingPlanUserId={editingPlanUserId}
                  setEditingPlanUserId={setEditingPlanUserId}
                  editingPlan={editingPlan}
                  setEditingPlan={setEditingPlan}
                  editingPlanType={editingPlanType}
                  setEditingPlanType={setEditingPlanType}
                  editingPlanTier={editingPlanTier}
                  setEditingPlanTier={setEditingPlanTier}
                  onUpdateRole={handleUpdateUserRole}
                  onUpdatePlan={() => handleUpdatePlan(user.id)}
                  onQuickGrantPro={(type, tier) => handleQuickGrantPro(user.id, type, tier)}
                  onRevokePro={() => handleRevokePro(user.id)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {userPagination && userPagination.totalPages > 1 && (
            <PaginationBar
              page={userPage}
              totalPages={userPagination.totalPages}
              total={userPagination.total}
              onPageChange={setUserPage}
            />
          )}
        </div>
      </Card>

      {/* ── Institution Details (Platform admin only) ── */}
      {isPlatformAdmin && stats?.institution_details && stats.institution_details.length > 0 && (() => {
        const allInst = stats.institution_details!;
        const instTotalPages = Math.ceil(allInst.length / PAGE_SIZE);
        const instSlice = allInst.slice((instPage - 1) * PAGE_SIZE, instPage * PAGE_SIZE);
        return (
          <Card className="bg-surface-100 dark:bg-surface-800">
            <div className="p-6 border-b border-surface-200 dark:border-surface-700">
              <h2 className="text-xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-600" />
                Institutionen — Übersicht
              </h2>
              <p className="text-surface-600 dark:text-surface-400 text-sm mt-1">
                Studenten, Admins und aktive Nutzer pro Institution
              </p>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 dark:border-surface-700">
                      <th className="text-left py-3 px-4 font-medium text-surface-900 dark:text-surface-50">Institution</th>
                      <th className="text-right py-3 px-4 font-medium text-surface-900 dark:text-surface-50">Studenten</th>
                      <th className="text-right py-3 px-4 font-medium text-surface-900 dark:text-surface-50">Admins</th>
                      <th className="text-right py-3 px-4 font-medium text-surface-900 dark:text-surface-50">Aktiv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instSlice.map((inst) => (
                      <tr key={inst.id} className="border-b border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-700/50">
                        <td className="py-3 px-4 font-medium text-surface-900 dark:text-surface-50">{inst.name}</td>
                        <td className="py-3 px-4 text-right text-surface-600 dark:text-surface-400">{inst.studentCount}</td>
                        <td className="py-3 px-4 text-right text-surface-600 dark:text-surface-400">{inst.adminCount}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-flex items-center gap-1.5">
                            <OnlineDot online={inst.activeCount > 0} />
                            <span className="text-surface-600 dark:text-surface-400">{inst.activeCount}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {instTotalPages > 1 && (
                <PaginationBar
                  page={instPage}
                  totalPages={instTotalPages}
                  total={allInst.length}
                  onPageChange={setInstPage}
                  label="Institutionen"
                />
              )}
            </div>
          </Card>
        );
      })()}

      {/* ── Institution Admin Assignments (Platform admin only) ── */}
      {isPlatformAdmin && (
        <Card className="bg-surface-100 dark:bg-surface-800">
          <div className="p-6 border-b border-surface-200 dark:border-surface-700">
            <h2 className="text-xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-600" />
              Institutions-Admins
            </h2>
            <p className="text-surface-600 dark:text-surface-400 text-sm mt-1">
              Welche Institutions-Admins welchen Institutionen zugewiesen sind
            </p>
          </div>
          <div className="p-6">
            {institutionAdminsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-brand-600" /></div>
            ) : institutionAdmins.length === 0 ? (
              <p className="text-center text-surface-600 dark:text-surface-400 py-8">Keine Institutions-Admins vorhanden</p>
            ) : (() => {
              const iaTotalPages = Math.ceil(institutionAdmins.length / PAGE_SIZE);
              const iaSlice = institutionAdmins.slice((instAdminPage - 1) * PAGE_SIZE, instAdminPage * PAGE_SIZE);
              return (
                <div className="space-y-3">
                  {iaSlice.map((a) => (
                    <div key={a.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 gap-3 sm:gap-4 bg-[rgb(var(--card-bg))] dark:bg-surface-700 rounded-lg border border-surface-200 dark:border-surface-600">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-surface-900 dark:text-surface-50 truncate">{a.user_name || a.user_email}</p>
                        <p className="text-sm text-surface-600 dark:text-surface-400 truncate">{a.user_email} → {a.institution_name}</p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/admin/institution-admins", {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ user_id: a.user_id, institution_id: a.institution_id }),
                            });
                            if (!res.ok) throw new Error();
                            toast.success("Institutions-Zuweisung entfernt");
                            const fetchRes = await fetch("/api/admin/institution-admins");
                            if (fetchRes.ok) { const data = await fetchRes.json(); setInstitutionAdmins(data.assignments || []); }
                          } catch { toast.error("Fehler beim Entfernen"); }
                        }}
                        className="p-2 text-surface-600 dark:text-surface-400 hover:text-red-600 dark:hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {iaTotalPages > 1 && (
                    <PaginationBar
                      page={instAdminPage}
                      totalPages={iaTotalPages}
                      total={institutionAdmins.length}
                      onPageChange={setInstAdminPage}
                      label="Admins"
                    />
                  )}
                </div>
              );
            })()}
          </div>
        </Card>
      )}

      {/* ── Institutions-Admins section for institution role ── */}
      {isInstitution && !isPlatformAdmin && (
        <Card className="bg-surface-100 dark:bg-surface-800">
          <div className="p-6 border-b border-surface-200 dark:border-surface-700">
            <h2 className="text-xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-600" />
              Institutions-Admins
            </h2>
            <p className="text-surface-600 dark:text-surface-400 text-sm mt-1">
              Übersicht der Admins deiner Institution
            </p>
          </div>
          <div className="p-6">
            {users.filter((u) => u.user_role === "institution").length === 0 ? (
              <p className="text-center text-surface-600 dark:text-surface-400 py-8">Keine weiteren Institutions-Admins</p>
            ) : (
              <div className="space-y-3">
                {users.filter((u) => u.user_role === "institution").map((u) => (
                  <div key={u.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 gap-3 sm:gap-4 bg-[rgb(var(--card-bg))] dark:bg-surface-700 rounded-lg border border-surface-200 dark:border-surface-600">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <OnlineDot online={isOnline(u.last_seen_at)} />
                      <div className="min-w-0">
                        <p className="font-medium text-surface-900 dark:text-surface-50 truncate">{u.full_name || u.username || u.email}</p>
                        <p className="text-sm text-surface-600 dark:text-surface-400 truncate">{u.email}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS.institution}`}>
                      {ROLE_LABELS.institution}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Audit Log (Platform admin only) ── */}
      {isPlatformAdmin && (
        <Card className="bg-surface-100 dark:bg-surface-800">
          <div className="p-6 border-b border-surface-200 dark:border-surface-700">
            <h2 className="text-xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand-600" />
              Audit-Log
            </h2>
          </div>
          <div className="p-6">
            {auditLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-brand-600" /></div>
            ) : auditLog.length === 0 ? (
              <p className="text-center text-surface-600 dark:text-surface-400 py-8">Keine Audit-Log-Einträge</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 dark:border-surface-700">
                      <th className="text-left py-3 px-4 font-medium text-surface-900 dark:text-surface-50">Zeitpunkt</th>
                      <th className="text-left py-3 px-4 font-medium text-surface-900 dark:text-surface-50">Benutzer</th>
                      <th className="text-left py-3 px-4 font-medium text-surface-900 dark:text-surface-50">Aktion</th>
                      <th className="text-left py-3 px-4 font-medium text-surface-900 dark:text-surface-50">Objekt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((entry) => (
                      <tr key={entry.id} className="border-b border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-700/50">
                        <td className="py-3 px-4 text-surface-600 dark:text-surface-400">{new Date(entry.created_at).toLocaleString("de-CH")}</td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-surface-900 dark:text-surface-50">{entry.user_name || entry.user_email}</p>
                          <p className="text-xs text-surface-600 dark:text-surface-400">{entry.user_email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-surface-200 dark:bg-surface-700 text-surface-900 dark:text-surface-50 rounded text-xs font-medium">{entry.action}</span>
                        </td>
                        <td className="py-3 px-4 text-surface-600 dark:text-surface-400">
                          <p className="font-medium text-surface-900 dark:text-surface-50">{entry.entity_type}</p>
                          <p className="text-xs text-surface-600 dark:text-surface-400">{entry.entity_name || entry.entity_id}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Sub-Components ──

/** Green pulsing dot = online, gray = offline */
function OnlineDot({ online }: { online: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {online && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${online ? "bg-green-500" : "bg-surface-400"}`} />
    </span>
  );
}

/** Pagination bar with page numbers */
function PaginationBar({
  page,
  totalPages,
  total,
  onPageChange,
  label = "Benutzer",
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-surface-200 dark:border-surface-700">
      <p className="text-sm text-surface-500 dark:text-surface-400">{total} {label} insgesamt</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-2 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
          .reduce<(number | "...")[]>((acc, p, idx, arr) => {
            if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
            acc.push(p);
            return acc;
          }, [])
          .map((item, idx) =>
            item === "..." ? (
              <span key={`dots-${idx}`} className="px-2 text-surface-400 dark:text-surface-500 text-sm">...</span>
            ) : (
              <button
                key={item}
                onClick={() => onPageChange(item as number)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                  item === page
                    ? "bg-brand-600 text-white dark:bg-brand-700 dark:text-surface-50"
                    : "text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
                }`}
              >
                {item}
              </button>
            ),
          )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-2 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/** User row in the user management list */
function UserRow({
  user,
  isPlatformAdmin,
  canEdit,
  allowedRoles,
  expandedUserId,
  setExpandedUserId,
  editingUserId,
  setEditingUserId,
  editingRole,
  setEditingRole,
  editingPlanUserId,
  setEditingPlanUserId,
  editingPlan,
  setEditingPlan,
  editingPlanType,
  setEditingPlanType,
  editingPlanTier,
  setEditingPlanTier,
  onUpdateRole,
  onUpdatePlan,
  onQuickGrantPro,
  onRevokePro,
}: {
  user: UserData;
  isPlatformAdmin: boolean;
  canEdit: boolean;
  allowedRoles: string[];
  expandedUserId: string | null;
  setExpandedUserId: (id: string | null) => void;
  editingUserId: string | null;
  setEditingUserId: (id: string | null) => void;
  editingRole: string;
  setEditingRole: (r: string) => void;
  editingPlanUserId: string | null;
  setEditingPlanUserId: (id: string | null) => void;
  editingPlan: "free" | "pro";
  setEditingPlan: (p: "free" | "pro") => void;
  editingPlanType: "free" | "subscription" | "lifetime";
  setEditingPlanType: (t: "free" | "subscription" | "lifetime") => void;
  editingPlanTier: "basic" | "full";
  setEditingPlanTier: (t: "basic" | "full") => void;
  onUpdateRole: (userId: string, role: string) => void;
  onUpdatePlan: () => void;
  onQuickGrantPro: (type: "subscription" | "lifetime", tier: "basic" | "full") => void;
  onRevokePro: () => void;
}) {
  const isExpanded = expandedUserId === user.id;
  const isPro = user.plan === "pro";
  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
  const online = isOnline(user.last_seen_at);
  const planLabel = isPro
    ? `Pro ${user.plan_type === "lifetime" ? "Lifetime" : "Abo"}${user.plan_tier ? ` (${user.plan_tier})` : ""}`
    : "Free";

  return (
    <div className="bg-[rgb(var(--card-bg))] rounded-lg border border-surface-200 hover:border-surface-300 transition-colors">
      {/* Main row */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <OnlineDot online={online} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-surface-900 truncate">
                {user.full_name || user.username || user.email}
              </p>
              {isSuperAdmin && !isPlatformAdmin && (
                <span title="Geschützter Account"><Lock className="w-3.5 h-3.5 text-surface-400" /></span>
              )}
            </div>
            <p className="text-sm text-surface-600 truncate">{user.email}</p>
            {user.created_at && (
              <p className="text-[10px] text-surface-400 mt-0.5">
                Registriert: {new Date(user.created_at).toLocaleDateString("de-CH")}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[user.user_role] || ROLE_COLORS.non_student}`}>
            {ROLE_LABELS[user.user_role] || user.user_role}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            isPro ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
              : "bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-400"
          }`}>
            {isPro && <Crown className="w-3 h-3 inline mr-1 -mt-0.5" />}{planLabel}
          </span>
          {VERIFICATION_BADGES[user.verification_status] && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${VERIFICATION_BADGES[user.verification_status]!.className}`}>
              {VERIFICATION_BADGES[user.verification_status]!.label}
            </span>
          )}
          {canEdit && (
            <button
              onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
              className="p-2 text-surface-500 hover:text-brand-600 transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail panel */}
      {isExpanded && canEdit && (
        <div className="border-t border-surface-200 p-4 bg-surface-50 dark:bg-surface-800/50 space-y-4">
          {/* ─── Role editing ─── */}
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Rolle</p>
            {editingUserId === user.id ? (
              <div className="flex items-center gap-2">
                <select
                  value={editingRole}
                  onChange={(e) => setEditingRole(e.target.value)}
                  className="px-3 py-2 border border-surface-300 rounded-lg bg-[rgb(var(--card-bg))] text-surface-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {allowedRoles.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                  ))}
                </select>
                <button
                  onClick={() => onUpdateRole(user.id, editingRole)}
                  className="px-3 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-xs font-medium"
                >
                  Speichern
                </button>
                <button onClick={() => setEditingUserId(null)} className="p-2 text-surface-600 hover:text-surface-900">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[user.user_role] || ROLE_COLORS.non_student}`}>
                  {ROLE_LABELS[user.user_role] || user.user_role}
                </span>
                <button
                  onClick={() => { setEditingUserId(user.id); setEditingRole(user.user_role); }}
                  className="p-1.5 text-surface-500 hover:text-brand-600 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* ─── Plan editing ─── */}
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Abo & Plan</p>

            {/* Info cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <InfoCell label="Plan" value={user.plan === "pro" ? "Pro" : "Free"} />
              <InfoCell label="Typ" value={user.plan_type === "lifetime" ? "Lifetime" : user.plan_type === "subscription" ? "Abo" : "Free"} />
              <InfoCell label="Stufe" value={user.plan_tier === "full" ? "Full" : user.plan_tier === "basic" ? "Basic" : "—"} />
              <InfoCell label="Stripe" value={user.stripe_subscription_status || "—"} />
            </div>

            {user.plan_expires_at && (
              <p className="text-xs text-surface-500 mb-3">
                Ablauf: <span className="font-medium">{new Date(user.plan_expires_at).toLocaleDateString("de-CH")}</span>
                {new Date(user.plan_expires_at) < new Date() && (
                  <span className="text-red-500 ml-1.5 font-semibold">ABGELAUFEN</span>
                )}
              </p>
            )}

            {/* Plan actions */}
            {editingPlanUserId === user.id ? (
              <div className="bg-[rgb(var(--card-bg))] rounded-lg p-4 border border-brand-200 dark:border-brand-800 space-y-3">
                <p className="text-sm font-semibold text-surface-900">Plan manuell setzen</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-surface-600 mb-1 block">Plan</label>
                    <select
                      value={editingPlan}
                      onChange={(e) => setEditingPlan(e.target.value as "free" | "pro")}
                      className="w-full px-2.5 py-1.5 text-sm border border-surface-300 rounded-lg bg-[rgb(var(--card-bg))] text-surface-900"
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                    </select>
                  </div>
                  {editingPlan === "pro" && (
                    <>
                      <div>
                        <label className="text-xs text-surface-600 mb-1 block">Typ</label>
                        <select
                          value={editingPlanType}
                          onChange={(e) => setEditingPlanType(e.target.value as "subscription" | "lifetime")}
                          className="w-full px-2.5 py-1.5 text-sm border border-surface-300 rounded-lg bg-[rgb(var(--card-bg))] text-surface-900"
                          disabled={!isPlatformAdmin}
                        >
                          {isPlatformAdmin && <option value="subscription">Abo</option>}
                          <option value="lifetime">Lifetime</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-surface-600 mb-1 block">Stufe</label>
                        <select
                          value={editingPlanTier}
                          onChange={(e) => setEditingPlanTier(e.target.value as "basic" | "full")}
                          className="w-full px-2.5 py-1.5 text-sm border border-surface-300 rounded-lg bg-[rgb(var(--card-bg))] text-surface-900"
                          disabled={!isPlatformAdmin}
                        >
                          {isPlatformAdmin && <option value="basic">Basic</option>}
                          <option value="full">Full</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onUpdatePlan}
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-xs font-medium"
                  >
                    Plan speichern
                  </button>
                  <button onClick={() => setEditingPlanUserId(null)} className="px-3 py-2 text-surface-600 text-xs">
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {!isPro ? (
                  isPlatformAdmin ? (
                    <>
                      <QuickBtn onClick={() => onQuickGrantPro("subscription", "basic")} color="amber" icon={<Crown className="w-3 h-3" />} label="Pro Basic" />
                      <QuickBtn onClick={() => onQuickGrantPro("subscription", "full")} color="amber" icon={<Crown className="w-3 h-3" />} label="Pro Full" />
                      <QuickBtn onClick={() => onQuickGrantPro("lifetime", "full")} color="purple" icon={<Infinity className="w-3 h-3" />} label="Lifetime Full" />
                    </>
                  ) : (
                    <QuickBtn onClick={() => onQuickGrantPro("lifetime", "full")} color="amber" icon={<Crown className="w-3 h-3" />} label="Pro Lifetime Full aktivieren" />
                  )
                ) : (
                  <QuickBtn onClick={onRevokePro} color="red" icon={<XCircle className="w-3 h-3" />} label="Pro widerrufen" />
                )}
                <button
                  onClick={() => {
                    setEditingPlanUserId(user.id);
                    setEditingPlan(user.plan);
                    setEditingPlanType(user.plan_type === "lifetime" ? "lifetime" : user.plan_type === "subscription" ? "subscription" : "free");
                    setEditingPlanTier(user.plan_tier === "full" ? "full" : "basic");
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-surface-100 text-surface-700 dark:bg-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-600 transition"
                >
                  <Edit2 className="w-3 h-3 inline mr-1 -mt-0.5" />Manuell setzen
                </button>
              </div>
            )}
          </div>

          {/* Delete User Section */}
          {canEdit && !isSuperAdmin && (
            <div className="border-t border-red-100 dark:border-red-900/50 pt-3 mt-3">
              <DeleteUserButton userId={user.id} username={user.username || user.email} onDeleted={() => setExpandedUserId(null)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Utility Components ──

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  accent?: boolean;
  subtitle?: string;
}

function StatsCard({ icon, label, value, loading, accent, subtitle }: StatsCardProps) {
  return (
    <Card className={accent ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800" : "bg-surface-100"}>
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-sm ${accent ? "text-amber-700 dark:text-amber-400" : "text-surface-600"}`}>{label}</p>
            <p className={`text-3xl font-bold mt-2 ${accent ? "text-amber-900 dark:text-amber-200" : "text-surface-900"}`}>
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : value}
            </p>
            {subtitle && !loading && (
              <p className="text-xs text-surface-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={accent ? "text-amber-600 dark:text-amber-400" : "text-brand-600"}>{icon}</div>
        </div>
      </div>
    </Card>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[rgb(var(--card-bg))] rounded-lg p-2.5 border border-surface-200">
      <p className="text-[10px] text-surface-500">{label}</p>
      <p className="text-sm font-semibold text-surface-900">{value}</p>
    </div>
  );
}

const COLOR_MAP: Record<string, string> = {
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40",
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40",
  red: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40",
};

function QuickBtn({ onClick, color, icon, label }: { onClick: () => void; color: string; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition ${COLOR_MAP[color] || COLOR_MAP.amber}`}>
      {icon}{label}
    </button>
  );
}

function DeleteUserButton({ userId, username, onDeleted }: { userId: string; username: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Fehler beim Löschen");
        setDeleting(false);
        return;
      }
      toast.success(`Benutzer ${username} gelöscht`);
      onDeleted();
      // Refresh the page to update the user list
      window.location.reload();
    } catch {
      toast.error("Fehler beim Löschen");
      setDeleting(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition"
      >
        <Trash2 className="w-3 h-3" />
        Konto löschen
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-2">
      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
      <span className="text-xs text-red-700 dark:text-red-300 flex-1">
        <strong>{username}</strong> wirklich löschen? Alle Daten werden unwiderruflich entfernt.
      </span>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="px-3 py-1 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition"
      >
        {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Ja, löschen"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        disabled={deleting}
        className="px-2 py-1 text-surface-500 text-xs hover:text-surface-700 dark:hover:text-surface-300 transition"
      >
        Abbrechen
      </button>
    </div>
  );
}
