"use client";
import {
  Gem,
  BookOpen,
  Brain,
  Layers,
  Monitor,
  Smartphone,
  Globe,
  Shield,
  Zap,
  ExternalLink,
  Check,
  FileText,
  Network,
  BarChart3,
  Sparkles,
  History,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export default function AboutPage() {
  const { t } = useTranslation();
  return (
 <div className="min-h-screen bg-surface-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-transparent dark:from-brand-950/20 dark:to-transparent py-12 sm:py-16 px-3 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-16 sm:w-20 h-16 sm:h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white mb-4 sm:mb-6 shadow-lg">
            <Gem size={32} className="sm:w-10 sm:h-10" />
          </div>

          {/* App Name & Tagline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-surface-900 dark:text-white mb-3 sm:mb-4">
            {t("about.title")}
          </h1>
 <p className="text-lg sm:text-2xl text-surface-600 font-medium mb-2 sm:mb-3">
            {t("about.tagline")}
          </p>

          {/* Version Badge */}
 <div className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-surface-100 text-surface-600 text-xs sm:text-sm font-medium">
            <span>{t("about.version")}</span>
          </div>
        </div>
      </div>

      {/* Mission Statement */}
      <div className="max-w-3xl mx-auto px-3 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
 <p className="text-base sm:text-lg text-surface-600 leading-relaxed">
          {t("about.mission")}
        </p>
      </div>

      {/* Feature Highlights */}
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white text-center mb-8 sm:mb-12">
          {t("about.whySemetra")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Feature 1: AI-Learning */}
          <div className="card p-5 sm:p-8 border border-brand-100 dark:border-brand-900/30 hover:shadow-md transition-shadow">
            <div className="inline-flex items-center justify-center w-12 sm:w-14 h-12 sm:h-14 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 mb-4 sm:mb-5">
              <Brain size={24} className="sm:w-7 sm:h-7" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-surface-900 dark:text-white mb-2 sm:mb-3">
              {t("about.featureAi")}
            </h3>
 <p className="text-surface-600 text-sm leading-relaxed">
              {t("about.featureAiDesc")}
            </p>
          </div>

          {/* Feature 2: Module Planning */}
          <div className="card p-5 sm:p-8 border border-brand-100 dark:border-brand-900/30 hover:shadow-md transition-shadow">
            <div className="inline-flex items-center justify-center w-12 sm:w-14 h-12 sm:h-14 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 mb-4 sm:mb-5">
              <BookOpen size={24} className="sm:w-7 sm:h-7" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-surface-900 dark:text-white mb-2 sm:mb-3">
              {t("about.featureModules")}
            </h3>
 <p className="text-surface-600 text-sm leading-relaxed">
              {t("about.featureModulesDesc")}
            </p>
          </div>

          {/* Feature 3: Cross-Platform */}
          <div className="card p-5 sm:p-8 border border-brand-100 dark:border-brand-900/30 hover:shadow-md transition-shadow">
            <div className="inline-flex items-center justify-center w-12 sm:w-14 h-12 sm:h-14 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 mb-4 sm:mb-5">
              <Layers size={24} className="sm:w-7 sm:h-7" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-surface-900 dark:text-white mb-2 sm:mb-3">
              {t("about.featureCrossPlatform")}
            </h3>
 <p className="text-surface-600 text-sm leading-relaxed">
              {t("about.featureCrossPlatformDesc")}
            </p>
          </div>

          {/* Feature 4: Data Security */}
          <div className="card p-5 sm:p-8 border border-brand-100 dark:border-brand-900/30 hover:shadow-md transition-shadow">
            <div className="inline-flex items-center justify-center w-12 sm:w-14 h-12 sm:h-14 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 mb-4 sm:mb-5">
              <Shield size={24} className="sm:w-7 sm:h-7" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-surface-900 dark:text-white mb-2 sm:mb-3">
              {t("about.featureSecurity")}
            </h3>
 <p className="text-surface-600 text-sm leading-relaxed">
              {t("about.featureSecurityDesc")}
            </p>
          </div>

          {/* Feature 5: PDF Tools */}
          <div className="card p-5 sm:p-8 border border-brand-100 dark:border-brand-900/30 hover:shadow-md transition-shadow">
            <div className="inline-flex items-center justify-center w-12 sm:w-14 h-12 sm:h-14 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 mb-4 sm:mb-5">
              <FileText size={24} className="sm:w-7 sm:h-7" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-surface-900 dark:text-white mb-2 sm:mb-3">
              {t("about.featurePdfTools")}
            </h3>
 <p className="text-surface-600 text-sm leading-relaxed">
              {t("about.featurePdfToolsDesc")}
            </p>
          </div>

          {/* Feature 6: Mind Maps */}
          <div className="card p-5 sm:p-8 border border-brand-100 dark:border-brand-900/30 hover:shadow-md transition-shadow">
            <div className="inline-flex items-center justify-center w-12 sm:w-14 h-12 sm:h-14 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 mb-4 sm:mb-5">
              <Network size={24} className="sm:w-7 sm:h-7" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-surface-900 dark:text-white mb-2 sm:mb-3">
              {t("about.featureMindMaps")}
            </h3>
 <p className="text-surface-600 text-sm leading-relaxed">
              {t("about.featureMindMapsDesc")}
            </p>
          </div>

          {/* Feature 7: Grade Analytics */}
          <div className="card p-5 sm:p-8 border border-brand-100 dark:border-brand-900/30 hover:shadow-md transition-shadow">
            <div className="inline-flex items-center justify-center w-12 sm:w-14 h-12 sm:h-14 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 mb-4 sm:mb-5">
              <BarChart3 size={24} className="sm:w-7 sm:h-7" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-surface-900 dark:text-white mb-2 sm:mb-3">
              {t("about.featureGradeAnalytics")}
            </h3>
 <p className="text-surface-600 text-sm leading-relaxed">
              {t("about.featureGradeAnalyticsDesc")}
            </p>
          </div>

          {/* Feature 8: Academic Builder */}
          <div className="card p-5 sm:p-8 border border-brand-100 dark:border-brand-900/30 hover:shadow-md transition-shadow">
            <div className="inline-flex items-center justify-center w-12 sm:w-14 h-12 sm:h-14 rounded-xl bg-teal-100 dark:bg-teal-900/30 text-teal-600 mb-4 sm:mb-5">
              <GraduationCap size={24} className="sm:w-7 sm:h-7" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-surface-900 dark:text-white mb-2 sm:mb-3">
              {t("about.featureBuilder")}
            </h3>
 <p className="text-surface-600 text-sm leading-relaxed">
              {t("about.featureBuilderDesc")}
            </p>
          </div>

          {/* Feature 9: 20+ Tools */}
          <div className="card p-5 sm:p-8 border border-brand-100 dark:border-brand-900/30 hover:shadow-md transition-shadow">
            <div className="inline-flex items-center justify-center w-12 sm:w-14 h-12 sm:h-14 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 mb-4 sm:mb-5">
              <Sparkles size={24} className="sm:w-7 sm:h-7" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-surface-900 dark:text-white mb-2 sm:mb-3">
              {t("about.featureToolkit")}
            </h3>
 <p className="text-surface-600 text-sm leading-relaxed">
              {t("about.featureToolkitDesc")}
            </p>
          </div>
        </div>
      </div>

      {/* What's New / Changelog */}
 <div className="bg-gradient-to-b from-transparent to-surface-50 py-12 sm:py-16 px-3 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-8 sm:mb-12">
            <History size={24} className="text-brand-600" />
            <h2 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white">
              {t("about.whatsNew")}
            </h2>
          </div>

          <div className="space-y-6">
            {/* v2.7 — April 2026 */}
 <div className="card p-3 sm:p-6 border border-surface-200 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-600 text-white text-xs font-semibold">
                  v2.7
                </span>
                <span className="text-sm text-surface-500">{t("about.changelogApril2026v2_7")}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold">NEU</span>
              </div>
              <ul className="space-y-2">
                {t("about.changelog2_7").split("|").map((item, i) => (
 <li key={i} className="flex items-start gap-2.5 text-sm text-surface-700">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold">✓</span>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* v2.6 — April 2026 */}
 <div className="card p-3 sm:p-6 border border-surface-200">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs font-semibold">
                  v2.6
                </span>
                <span className="text-sm text-surface-500">{t("about.changelogApril2026")}</span>
              </div>
              <ul className="space-y-2">
                {t("about.changelog2_6").split("|").map((item, i) => (
 <li key={i} className="flex items-start gap-2.5 text-sm text-surface-700">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold">✓</span>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* v2.5 */}
 <div className="card p-3 sm:p-6 border border-surface-200">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs font-semibold">
                  v2.5
                </span>
                <span className="text-sm text-surface-500">{t("about.changelogApril2026")}</span>
              </div>
              <ul className="space-y-2">
                {t("about.changelog2_5").split("|").map((item, i) => (
 <li key={i} className="flex items-start gap-2.5 text-sm text-surface-700">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold">✓</span>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Earlier */}
 <div className="card p-3 sm:p-6 border border-surface-200">
              <div className="flex items-center gap-3 mb-4">
 <span className="inline-flex items-center px-3 py-1 rounded-full bg-surface-200 text-surface-600 text-xs font-semibold">
                  v2.0
                </span>
                <span className="text-sm text-surface-500">{t("about.changelogV2")}</span>
              </div>
              <ul className="space-y-2">
                {t("about.changelog2_0").split("|").map((item, i) => (
 <li key={i} className="flex items-start gap-2.5 text-sm text-surface-700">
 <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-surface-100 text-surface-500 flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold">✓</span>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Section */}
 <div className="bg-surface-50 py-12 sm:py-16 px-3 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white text-center mb-8 sm:mb-12">
            {t("about.platformTitle")}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Web */}
 <div className="card p-5 sm:p-8 border border-surface-200">
              <div className="flex items-center justify-between mb-4 sm:mb-5">
                <div className="inline-flex items-center justify-center w-10 sm:w-12 h-10 sm:h-12 rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-600">
                  <Globe size={20} className="sm:w-6 sm:h-6" />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  {t("about.platformStatus")}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">
                {t("about.platformWeb")}
              </h3>
 <p className="text-surface-600 text-sm mb-3 sm:mb-4">
                {t("about.platformWebDesc")}
              </p>
              <p className="text-xs text-surface-500">
                {t("about.platformWebUrl")}
              </p>
            </div>

            {/* Desktop */}
 <div className="card p-5 sm:p-8 border border-surface-200 opacity-75">
              <div className="flex items-center justify-between mb-4 sm:mb-5">
 <div className="inline-flex items-center justify-center w-10 sm:w-12 h-10 sm:h-12 rounded-lg bg-surface-200 text-surface-500">
                  <Monitor size={20} className="sm:w-6 sm:h-6" />
                </div>
 <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-200 text-surface-600 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-surface-400" />
                  {t("about.platformStatusDevelopment")}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">
                {t("about.platformDesktop")}
              </h3>
 <p className="text-surface-600 text-sm mb-3 sm:mb-4">
                {t("about.platformDesktopDesc")}
              </p>
              <p className="text-xs text-surface-500">
                {t("about.platformDesktopOs")}
              </p>
            </div>

            {/* Mobile */}
 <div className="card p-5 sm:p-8 border border-surface-200 opacity-75">
              <div className="flex items-center justify-between mb-4 sm:mb-5">
 <div className="inline-flex items-center justify-center w-10 sm:w-12 h-10 sm:h-12 rounded-lg bg-surface-200 text-surface-500">
                  <Smartphone size={20} className="sm:w-6 sm:h-6" />
                </div>
 <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-200 text-surface-600 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-surface-400" />
                  {t("about.platformStatusDevelopment")}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">
                {t("about.platformMobile")}
              </h3>
 <p className="text-surface-600 text-sm mb-3 sm:mb-4">
                {t("about.platformMobileDesc")}
              </p>
              <p className="text-xs text-surface-500">
                {t("about.platformMobileOs")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Overview — same card style as /upgrade */}
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white text-center mb-8 sm:mb-12">
          {t("about.pricingTitle")}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 max-w-4xl mx-auto mb-8">
          {/* Free */}
 <div className="bg-surface-100 rounded-2xl border-2 border-surface-200 p-4 sm:p-5">
            <div className="mb-4">
 <p className="text-xs sm:text-sm font-semibold text-surface-500 uppercase tracking-wide mb-1">{t("about.planFree")}</p>
              <p className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-white">CHF 0</p>
 <p className="text-xs text-surface-400 mt-1">{t("about.planFreeSubtitle")}</p>
            </div>
            <div className="space-y-1.5 sm:space-y-2 mb-4 sm:mb-5">
              {t("about.freeFeatures").split("|").map((feature, i) => (
 <div key={i} className="flex items-start gap-2 text-xs text-surface-600">
 <Check size={12} className="text-surface-400 shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
 <div className="w-full py-2 rounded-xl border-2 border-surface-200 text-surface-500 text-xs text-center font-medium">
              {t("about.startFree")}
            </div>
          </div>

          {/* Pro Basic */}
 <div className="bg-surface-100 rounded-2xl border-2 border-brand-500 p-4 sm:p-5 relative">
            <div className="absolute top-0 right-0 bg-brand-600 text-white text-[9px] sm:text-[10px] font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-bl-xl">
              BASIC
            </div>
            <div className="mb-4">
              <p className="text-xs sm:text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Pro Basic</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-white">{t("about.planProPrice")}</span>
 <span className="text-xs text-surface-400">{t("about.planProPerMonth")}</span>
              </div>
 <p className="text-xs text-surface-400 mt-1">{t("about.planProSubtitle")}</p>
            </div>
            <div className="space-y-1.5 sm:space-y-2 mb-4 sm:mb-5">
              {t("about.proFeatures").split("|").map((feature, i) => (
 <div key={i} className="flex items-start gap-2 text-xs text-surface-700">
                  <Check size={12} className="text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            <div className="w-full py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs text-center font-semibold">
              Coming Soon
            </div>
          </div>

          {/* Pro Full */}
 <div className="bg-surface-100 rounded-2xl border-2 border-surface-200 p-4 sm:p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-violet-600 to-brand-600 text-white text-[9px] sm:text-[10px] font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-bl-xl flex items-center gap-1">
              <Sparkles size={8} />
              FULL
            </div>
            <div className="mb-4">
              <p className="text-xs sm:text-sm font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-1">Pro Full</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-white">{t("about.planLifetimePrice")}</span>
              </div>
 <p className="text-xs text-surface-400 mt-1">{t("about.planLifetimeDesc")}</p>
            </div>
            <div className="space-y-1.5 sm:space-y-2 mb-4 sm:mb-5">
              {t("about.proFeatures").split("|").map((feature, i) => (
 <div key={i} className="flex items-start gap-2 text-xs text-surface-700">
                  <Check size={12} className="text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            <div className="w-full py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs text-center font-semibold">
              Coming Soon
            </div>
          </div>
        </div>
      </div>

      {/* Company Footer */}
 <div className="bg-surface-50 border-t border-surface-200 py-10 sm:py-12 px-3 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
 <p className="text-surface-700 font-medium mb-4">
            {t("about.company")}
          </p>

          <div className="flex items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm mb-4 sm:mb-6 flex-wrap">
            <Link
              href="https://semetra.ch"
              target="_blank"
              className="inline-flex items-center gap-1 sm:gap-1.5 text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium"
            >
              {t("about.website")}
              <ExternalLink size={13} className="sm:w-4 sm:h-4" />
            </Link>
            <Link
              href="/privacy"
 className="text-surface-600 hover:text-surface-900 dark:hover:text-surface-200 font-medium"
            >
              {t("about.privacy")}
            </Link>
          </div>

 <p className="text-xs text-surface-500">
            {t("about.copyright")}
          </p>
        </div>
      </div>
    </div>
  );
}
