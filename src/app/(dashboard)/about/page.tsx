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
  Crown,
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export default function AboutPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white mb-6 shadow-lg">
            <Gem size={40} />
          </div>

          {/* App Name & Tagline */}
          <h1 className="text-5xl sm:text-6xl font-bold text-surface-900 mb-4">
            {t("about.title")}
          </h1>
          <p className="text-xl sm:text-2xl text-surface-600 font-medium mb-3">
            {t("about.tagline")}
          </p>

          {/* Version Badge */}
          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-100 text-surface-600 text-sm font-medium">
            <span>{t("about.version")}</span>
          </div>
        </div>
      </div>

      {/* Mission Statement */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-lg text-surface-600 leading-relaxed">
          {t("about.mission")}
        </p>
      </div>

      {/* Feature Highlights */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-surface-900 text-center mb-12">
          {t("about.whySemetra")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Feature 1: AI-Learning */}
          <div className="card p-8 border border-brand-100 hover:shadow-md transition-shadow">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-brand-100 text-brand-600 mb-5">
              <Brain size={28} />
            </div>
            <h3 className="text-xl font-semibold text-surface-900 mb-3">
              {t("about.featureAi")}
            </h3>
            <p className="text-surface-600 text-sm leading-relaxed">
              {t("about.featureAiDesc")}
            </p>
          </div>

          {/* Feature 2: Module Planning */}
          <div className="card p-8 border border-brand-100 hover:shadow-md transition-shadow">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-brand-100 text-brand-600 mb-5">
              <BookOpen size={28} />
            </div>
            <h3 className="text-xl font-semibold text-surface-900 mb-3">
              {t("about.featureModules")}
            </h3>
            <p className="text-surface-600 text-sm leading-relaxed">
              {t("about.featureModulesDesc")}
            </p>
          </div>

          {/* Feature 3: Cross-Platform */}
          <div className="card p-8 border border-brand-100 hover:shadow-md transition-shadow">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-brand-100 text-brand-600 mb-5">
              <Layers size={28} />
            </div>
            <h3 className="text-xl font-semibold text-surface-900 mb-3">
              {t("about.featureCrossPlatform")}
            </h3>
            <p className="text-surface-600 text-sm leading-relaxed">
              {t("about.featureCrossPlatformDesc")}
            </p>
          </div>

          {/* Feature 4: Data Security */}
          <div className="card p-8 border border-brand-100 hover:shadow-md transition-shadow">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-brand-100 text-brand-600 mb-5">
              <Shield size={28} />
            </div>
            <h3 className="text-xl font-semibold text-surface-900 mb-3">
              {t("about.featureSecurity")}
            </h3>
            <p className="text-surface-600 text-sm leading-relaxed">
              {t("about.featureSecurityDesc")}
            </p>
          </div>
        </div>
      </div>

      {/* Platform Section */}
      <div className="bg-surface-50 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-surface-900 text-center mb-12">
            {t("about.platformTitle")}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Web */}
            <div className="card p-8 border border-surface-200">
              <div className="flex items-center justify-between mb-5">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-brand-100 text-brand-600">
                  <Globe size={24} />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  {t("about.platformStatus")}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-surface-900 mb-2">
                {t("about.platformWeb")}
              </h3>
              <p className="text-surface-600 text-sm mb-4">
                {t("about.platformWebDesc")}
              </p>
              <p className="text-xs text-surface-500">
                {t("about.platformWebUrl")}
              </p>
            </div>

            {/* Desktop */}
            <div className="card p-8 border border-surface-200">
              <div className="flex items-center justify-between mb-5">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-brand-100 text-brand-600">
                  <Monitor size={24} />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  {t("about.platformStatus")}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-surface-900 mb-2">
                {t("about.platformDesktop")}
              </h3>
              <p className="text-surface-600 text-sm mb-4">
                {t("about.platformDesktopDesc")}
              </p>
              <p className="text-xs text-surface-500">
                {t("about.platformDesktopOs")}
              </p>
            </div>

            {/* Mobile */}
            <div className="card p-8 border border-surface-200 opacity-75">
              <div className="flex items-center justify-between mb-5">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-surface-200 text-surface-500">
                  <Smartphone size={24} />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-200 text-surface-600 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-surface-400" />
                  {t("about.platformStatusDevelopment")}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-surface-900 mb-2">
                {t("about.platformMobile")}
              </h3>
              <p className="text-surface-600 text-sm mb-4">
                {t("about.platformMobileDesc")}
              </p>
              <p className="text-xs text-surface-500">
                {t("about.platformMobileOs")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Overview */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-surface-900 text-center mb-12">
          {t("about.pricingTitle")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Free Plan */}
          <div className="card p-8 border border-surface-200">
            <h3 className="text-2xl font-bold text-surface-900 mb-2">
              {t("about.planFree")}
            </h3>
            <p className="text-surface-600 text-sm mb-6">
              {t("about.planFreeSubtitle")}
            </p>

            <ul className="space-y-3 mb-8">
              {t("about.freeFeatures").split("|").map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold">✓</span>
                  </span>
                  <span className="text-surface-700 text-sm">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href="/upgrade"
              className="inline-flex w-full items-center justify-center px-4 py-3 rounded-lg border border-surface-300 text-surface-900 font-medium hover:bg-surface-50 transition-colors text-sm"
            >
              {t("about.startFree")}
            </Link>
          </div>

          {/* Pro Plan */}
          <div className="card p-8 bg-gradient-to-br from-brand-50 to-brand-25 border-2 border-brand-300 relative">
            <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-600 text-white text-xs font-semibold">
              <Crown size={12} />
              {t("about.planProPopular")}
            </div>

            <h3 className="text-2xl font-bold text-surface-900 mb-2">
              {t("about.planPro")}
            </h3>
            <p className="text-surface-600 text-sm mb-2">
              {t("about.planProSubtitle")}
            </p>
            <div className="text-3xl font-bold text-brand-600 mb-6">
              {t("about.planProPrice")}
              <span className="text-lg text-surface-600 font-normal">{t("about.planProPerMonth")}</span>
            </div>

            <ul className="space-y-3 mb-8">
              {t("about.proFeatures").split("|").map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-white flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold">✓</span>
                  </span>
                  <span className="text-surface-700 text-sm">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href="/upgrade"
              className="inline-flex w-full items-center justify-center px-4 py-3 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors text-sm"
            >
              <Zap size={14} className="mr-2" />
              {t("about.upgradePro")}
            </Link>
          </div>
        </div>

        {/* Lifetime Plan */}
        <div className="card p-8 border border-surface-200 max-w-2xl mx-auto bg-surface-900 text-white">
          <div className="flex items-center gap-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-white/10 text-white">
              <Zap size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">
                {t("about.planLifetime")}
              </h3>
              <p className="text-white/60 text-sm">
                {t("about.planLifetimeDesc")}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {t("about.planLifetimePrice")}
              </div>
              <p className="text-xs text-white/50">{t("about.planLifetimeOneTime")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Company Footer */}
      <div className="bg-surface-50 border-t border-surface-200 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-surface-700 font-medium mb-4">
            {t("about.company")}
          </p>

          <div className="flex items-center justify-center gap-6 text-sm mb-6">
            <Link
              href="https://semetra.ch"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-700 font-medium"
            >
              {t("about.website")}
              <ExternalLink size={14} />
            </Link>
            <Link
              href="/privacy"
              className="text-surface-600 hover:text-surface-900 font-medium"
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
