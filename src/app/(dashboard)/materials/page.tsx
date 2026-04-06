"use client";

import { Suspense, lazy } from "react";
import { FileText, FolderOpen } from "lucide-react";
import { PageTabs } from "@/components/ui/PageTabs";
import { useTranslation } from "@/lib/i18n";

const NotesContent = lazy(() => import("../notes/page"));
const DocumentsContent = lazy(() => import("../documents/page"));

function Loading() {
  return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>;
}

export default function MaterialsPage() {
  const { t } = useTranslation();

  const tabs = [
    {
      id: "notes",
      label: t("nav.notes") || "Notizen",
      icon: FileText,
      content: <Suspense fallback={<Loading />}><NotesContent /></Suspense>,
    },
    {
      id: "documents",
      label: t("nav.documents") || "Dokumente",
      icon: FolderOpen,
      content: <Suspense fallback={<Loading />}><DocumentsContent /></Suspense>,
    },
  ];

  return (
    <PageTabs
      title={t("nav.materials") || "Materialien"}
      subtitle={t("materials.subtitle") || "Notizen & Dokumente verwalten"}
      icon={<FileText className="text-brand-600" size={26} />}
      tabs={tabs}
    />
  );
}
