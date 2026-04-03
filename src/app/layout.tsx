import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
