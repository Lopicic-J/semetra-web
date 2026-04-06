"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import toast from "react-hot-toast";
import { logger } from "@/lib/logger";

const log = logger("ui:groups");

interface Member {
  id: string;
  user_id: string;
  role: string;
  profiles: { username: string; full_name: string | null; avatar_url: string | null } | null;
}

interface RoleManagerProps {
  groupId: string;
  members: Member[];
  myRole: string;
  onUpdate: () => void;
}

export default function RoleManager({ groupId, members, myRole, onUpdate }: RoleManagerProps) {
  const { t } = useTranslation();
  const [updating, setUpdating] = useState<string | null>(null);

  const canManageRoles = myRole === "owner" || myRole === "admin";

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdating(userId);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || (t("groups.roleChangeError") || "Fehler beim Ändern der Rolle"));
        return;
      }

      toast.success(t("groups.roleChanged") || "Rolle geändert");
      onUpdate();
    } catch (err) {
      log.error("update failed", err);
      toast.error(t("groups.roleChangeError") || "Fehler beim Ändern der Rolle");
    } finally {
      setUpdating(null);
    }
  };

  const getRoleLabel = (role: string) => {
    return t(`groups.role.${role}`) || role;
  };

  return (
    <div className="space-y-2">
      {members.map(member => (
        <div
          key={member.id}
          className="flex items-center justify-between py-3 px-3 bg-surface-50 rounded-xl hover:bg-surface-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            {member.profiles?.avatar_url ? (
              <img
                src={member.profiles.avatar_url}
                alt={member.profiles.username}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 text-xs font-bold">
                {(member.profiles?.full_name ?? member.profiles?.username ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-surface-800">
                {member.profiles?.full_name || member.profiles?.username}
              </p>
              <p className="text-[10px] text-surface-400">@{member.profiles?.username}</p>
            </div>
          </div>

          {/* Role selector */}
          {canManageRoles && member.role !== "owner" ? (
            <div className="relative group">
              <button
                disabled={updating === member.user_id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgb(var(--card-bg))] border border-surface-200 rounded-lg text-xs font-medium text-surface-700 hover:border-surface-300 disabled:opacity-50 transition-colors"
              >
                {updating === member.user_id ? "..." : getRoleLabel(member.role)}
                <ChevronDown size={12} />
              </button>

              {/* Dropdown menu */}
              {!updating && (
                <div className="absolute right-0 mt-1 w-32 bg-[rgb(var(--card-bg))] border border-surface-200 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-10">
                  {["member", "admin"].map(role => (
                    <button
                      key={role}
                      onClick={() => handleRoleChange(member.user_id, role)}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                        member.role === role
                          ? "bg-brand-50 text-brand-600 font-medium"
                          : "text-surface-700 hover:bg-surface-50"
                      }`}
                    >
                      {getRoleLabel(role)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-surface-200 text-surface-600">
              {getRoleLabel(member.role)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
