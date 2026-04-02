import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Semetra — Der smarte Studienplaner",
    template: "Semetra — %s",
  },
  description: "Dein FH-Studium automatisch organisiert. Module, Aufgaben, Lernziele und mehr.",
  keywords: [
    "Studienplaner",
    "FH",
    "Fachhochschule",
    "Studium",
    "Zeitmanagement",
    "Aufgabenmanagement",
    "Notizen",
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
    url: "https://semetra.com",
    title: "Semetra — Der smarte Studienplaner",
    description: "Dein FH-Studium automatisch organisiert. Module, Aufgaben, Lernziele und mehr.",
    siteName: "Semetra",
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
