import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import AuthProvider from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Xeno CRM Copilot | AI-Native Marketing Platform",
  description: "Xeno CRM Copilot — AI-powered mini CRM for retail brands to segment, message, and track personalized campaigns across WhatsApp, SMS and Email.",
  keywords: "CRM, marketing, AI, campaigns, customer segmentation, WhatsApp, retail",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-slate-950 text-slate-100 min-h-screen flex">
        <AuthProvider>
          <Sidebar />
          <main className="flex-1 overflow-auto min-h-screen">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
