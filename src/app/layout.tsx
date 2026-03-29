import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Semetra — Der smarte Studienplaner",
  description: "Dein FH-Studium automatisch organisiert. Module, Aufgaben, Lernziele und mehr.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
