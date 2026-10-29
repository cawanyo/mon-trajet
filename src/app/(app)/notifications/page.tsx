"use client";

import React, { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/navigation/BottomNav";
import {
  Bell,
  CheckCircle2,
  XCircle,
  Car,
  ShieldCheck,
  CheckCheck,
  Loader2,
} from "lucide-react";

export default function NotificationsPage() {
  const { user, token } = useAuth();
  const notifications = useQuery(api.users.getMyNotifications, token ? { token } : "skip");
  const markAsRead = useMutation(api.users.markNotificationsAsRead);

  // Marquer automatiquement comme lu à l'ouverture de la page
  useEffect(() => {
    if (token && notifications && notifications.some((n) => !n.isRead)) {
      markAsRead({ token });
    }
  }, [token, notifications, markAsRead]);

  const getIcon = (type: string) => {
    switch (type) {
      case "request_accepted":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "request_rejected":
      case "trip_cancelled":
        return <XCircle className="h-5 w-5 text-rose-500" />;
      case "user_approved":
        return <ShieldCheck className="h-5 w-5 text-indigo-500" />;
      default:
        return <Car className="h-5 w-5 text-amber-500" />;
    }
  };

  const formatTime = (ts: number) => {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return "À l'instant";
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    return new Date(ts).toLocaleDateString([], { day: "numeric", month: "short" });
  };

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 pb-24 text-slate-900 dark:text-white">
      <div
        className="bg-white dark:bg-slate-900 px-4 pb-4 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))" }}
      >
        <div>
          <h1 className="text-xl font-bold">Alertes & Notifications</h1>
          <p className="text-xs text-slate-500">Mises à jour de vos trajets et de votre compte</p>
        </div>
        <Bell className="h-5 w-5 text-slate-400" />
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {notifications === undefined ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 border border-slate-100 dark:border-slate-800">
            Aucune notification reçue pour l'instant.
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div
                key={notif._id}
                className={`rounded-2xl p-4 shadow-sm border transition-all ${
                  notif.isRead
                    ? "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                    : "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">{getIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm truncate">{notif.title}</h3>
                      <span className="text-[10px] text-slate-400 ml-2 flex-shrink-0">
                        {formatTime(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {notif.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav userRole={user?.role ?? "user"} />
    </div>
  );
}
