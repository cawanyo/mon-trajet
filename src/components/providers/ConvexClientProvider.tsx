"use client";

import { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { NotificationManager } from "@/components/notifications/NotificationManager";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ||
  "https://spotted-loris-303.eu-west-1.convex.cloud";

const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <AuthProvider>
        <ToastProvider>
          <NotificationManager />
          {children}
        </ToastProvider>
      </AuthProvider>
    </ConvexProvider>
  );
}
