import type { Metadata } from "next";
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
  icons: {
    icon: "/favicon.ico",
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        {/* Anti-flicker: apply dark class before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var m=localStorage.getItem("semetra_theme_mode");var d=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})()` }} />
      </head>
      <body>
        <ThemeWrapper>{children}</ThemeWrapper>
      </body>
    </html>
  );
}
