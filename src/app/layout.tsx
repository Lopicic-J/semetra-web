import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import ThemeWrapper from "@/components/providers/ThemeWrapper";

export const metadata: Metadata = {
  title: {
    default: "Semetra Workspace — Der smarte Studienplaner",
    template: "Semetra Workspace — %s",
  },
  description: "Dein Studium organisiert. Module, Aufgaben, Noten, Mathe-Tools und mehr — für FH und Uni.",
  keywords: [
    "Studienplaner",
    "FH",
    "Fachhochschule",
    "Universität",
    "Studium",
    "Zeitmanagement",
    "Aufgabenmanagement",
    "Notizen",
    "ECTS",
  ],
  authors: [{ name: "Lopicic Technologies" }],
  creator: "Lopicic Technologies",
  publisher: "Lopicic Technologies",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Semetra",
  },
  openGraph: {
    type: "website",
    locale: "de_CH",
    url: "https://app.semetra.ch",
    title: "Semetra Workspace — Der smarte Studienplaner",
    description: "Dein Studium organisiert. Module, Aufgaben, Noten, Mathe-Tools und mehr — für FH und Uni.",
    siteName: "Semetra Workspace",
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#6366f1" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1e1b4b" />
        {/* Anti-flicker: apply dark class before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var m=localStorage.getItem("semetra_theme_mode");var d=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})()` }} />
      </head>
      <body>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-600 focus:text-white focus:rounded-lg focus:outline-none">
          Zum Inhalt springen
        </a>
        <ThemeWrapper>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: "12px",
                background: "var(--color-surface-800, #1f2937)",
                color: "var(--color-surface-50, #f9fafb)",
                fontSize: "14px",
                padding: "12px 16px",
              },
              success: {
                iconTheme: { primary: "#10b981", secondary: "#fff" },
              },
              error: {
                duration: 6000,
                iconTheme: { primary: "#ef4444", secondary: "#fff" },
              },
            }}
          />
        </ThemeWrapper>
      </body>
    </html>
  );
}
