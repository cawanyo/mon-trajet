import type { Metadata, Viewport } from "next";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mon Trajet - Covoiturage Église",
  description: "Application PWA solidaire de covoiturage pour la communauté de l'église.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mon Trajet",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="h-full">
      <body className="h-full bg-[#f8fafc] text-slate-900 antialiased selection:bg-blue-100">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
