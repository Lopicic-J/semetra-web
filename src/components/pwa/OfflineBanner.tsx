"use client";

import { usePWA } from "@/lib/hooks/usePWA";
import { useTranslation } from "@/lib/i18n";
import { WifiOff } from "lucide-react";

/**
 * Slim banner that shows when the user goes offline.
 */
export default function OfflineBanner() {
  const { t } = useTranslation();
  const { isOnline } = usePWA();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white text-center py-1.5 text-xs font-medium flex items-center justify-center gap-2">
      <WifiOff size={13} />
      {t("pwa.offline")}
    </div>
  );
}
