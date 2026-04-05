"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, LogOut, Share2, Settings } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { logger } from "@/lib/logger";

const log = logger("ui:activity");

interface Activity {
  id: string;
  type: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  details: Record<string, unknown>;
}

interface ActivityFeedProps {
  groupId: string;
}

const ACTIVITY_ICONS = {
  member_joined: UserPlus,
  member_left: LogOut,
  resource_shared: Share2,
  group_updated: Settings,
};

const ACTIVITY_COLORS = {
  member_joined: "text-green-600",
  member_left: "text-red-600",
  resource_shared: "text-blue-600",
  group_updated: "text-purple-600",
};

export default function ActivityFeed({ groupId }: ActivityFeedProps) {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const loadActivities = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}/activity?limit=50`);
      const json = await res.json();
      if (json.activities) {
        setActivities(json.activities);
      }
    } catch (err) {
      log.error("load failed", err);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Gerade eben";
    if (minutes < 60) return `vor ${minutes}m`;
    if (hours < 24) return `vor ${hours}h`;
    if (days < 7) return `vor ${days}d`;
    if (days < 365) return d.toLocaleDateString("de-CH");

    return d.toLocaleDateString("de-CH");
  };

  const getActivityDescription = (activity: Activity): string => {
    switch (activity.type) {
      case "member_joined":
        return t("groups.activity.memberJoined")?.replace("{user}", activity.username) ||
          `${activity.username} ist der Gruppe beigetreten`;
      case "member_left":
        return t("groups.activity.memberLeft")?.replace("{user}", activity.username) ||
          `${activity.username} hat die Gruppe verlassen`;
      case "resource_shared":
        const resType = activity.details.resource_type === "note" ? "Notiz" : "Dokument";
        return t("groups.activity.resourceShared")?.replace("{user}", activity.username) ||
          `${activity.username} hat ${resType} geteilt`;
      case "group_updated":
        return t("groups.activity.groupUpdated")?.replace("{user}", activity.username) ||
          `${activity.username} hat die Gruppe aktualisiert`;
      default:
        return `${activity.username} hat etwas getan`;
    }
  };

  const displayedActivities = expanded ? activities : activities.slice(0, 5);
  const hasMore = activities.length > 5;

  return (
    <div className="card">
      <h2 className="font-semibold text-surface-800 mb-4 flex items-center gap-2">
        {t("groups.activity.title") || "Aktivität"}
      </h2>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-4 h-4 bg-surface-200 rounded-full shrink-0 mt-1" />
              <div className="flex-1">
                <div className="h-3 bg-surface-200 rounded w-40 mb-2" />
                <div className="h-2.5 bg-surface-100 rounded w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8 text-surface-400">
          <p className="text-sm">{t("groups.activity.empty") || "Noch keine Aktivität"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Timeline */}
          <div className="space-y-4">
            {displayedActivities.map((activity, idx) => {
              const IconComponent = ACTIVITY_ICONS[activity.type as keyof typeof ACTIVITY_ICONS] || Settings;
              const colorClass = ACTIVITY_COLORS[activity.type as keyof typeof ACTIVITY_COLORS] || "text-surface-400";

              return (
                <div key={activity.id} className="flex gap-3">
                  {/* Timeline dot and line */}
                  <div className="flex flex-col items-center pt-1">
                    <div className={`p-1.5 bg-surface-100 rounded-full ${colorClass}`}>
                      <IconComponent size={14} />
                    </div>
                    {idx < displayedActivities.length - 1 && (
                      <div className="w-0.5 h-12 bg-surface-200 my-2" />
                    )}
                  </div>

                  {/* Activity content */}
                  <div className="flex-1 pt-1 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-surface-700 leading-snug">
                          {getActivityDescription(activity)}
                        </p>
                        <p className="text-[10px] text-surface-400 mt-0.5">
                          {formatTime(activity.created_at)}
                        </p>
                      </div>
                      {activity.avatar_url && (
                        <img
                          src={activity.avatar_url}
                          alt={activity.username}
                          className="w-6 h-6 rounded-full object-cover shrink-0"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show more button */}
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full mt-4 px-3 py-2 text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors"
            >
              {expanded
                ? "▲ Weniger anzeigen"
                : `▼ ${t("groups.activity.showMore") || "Mehr anzeigen"} (${activities.length - 5} mehr)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
