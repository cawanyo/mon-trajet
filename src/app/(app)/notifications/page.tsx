"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/navigation/BottomNav";
import { useToast } from "@/components/ui/ToastProvider";
import { getNotificationTargetUrl } from "@/lib/notification-routes";
import { registerServiceWorkerAndSubscribe } from "@/lib/push-notifications";
import {
  Bell,
  CheckCircle2,
  XCircle,
  Car,
  ShieldCheck,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BellRing,
  Sparkles,
  Clock,
  Navigation,
  Smartphone,
  Share2,
} from "lucide-react";

export default function NotificationsPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { toast } = useToast();

  const notifications = useQuery(
    api.users.getMyNotifications,
    token ? { token } : "skip"
  );
  const markAllAsRead = useMutation(api.users.markNotificationsAsRead);
  const markSingleAsRead = useMutation(api.users.markSingleNotificationAsRead);
  const updatePushToken = useMutation(api.users.updatePushToken);

  // Statut des permissions de notifications du téléphone
  const [permissionState, setPermissionState] = useState<NotificationPermission>("default");
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isIosBrowser, setIsIosBrowser] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermissionState(Notification.permission);
    }
    if (typeof navigator !== "undefined") {
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const isStandalone = (window.navigator as any).standalone === true;
      setIsIosBrowser(isIos && !isStandalone);
    }
  }, []);

  const handleRequestPushPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.info("Les notifications ne sont pas supportées par ce navigateur.");
      return;
    }

    setIsRequestingPermission(true);
    try {
      const subStr = await registerServiceWorkerAndSubscribe();
      if (subStr && token) {
        await updatePushToken({ token, pushToken: subStr });
      }

      const perm = Notification.permission;
      setPermissionState(perm);

      if (perm === "granted") {
        toast.success("Notifications Web Push activées même application fermée !");
        // Notification test
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification("Mon Trajet Église", {
            body: "Les alertes mobiles sont prêtes, même application fermée !",
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-192x192.png",
          });
        }
      } else {
        toast.info("Notifications non autorisées. Veuillez vérifier les paramètres du navigateur.");
      }
    } catch (err) {
      toast.error("Impossible d'activer les notifications");
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleNotificationClick = async (notif: any) => {
    // 1. Marquer comme lue
    if (!notif.isRead && token) {
      try {
        await markSingleAsRead({
          token,
          notificationId: notif._id as Id<"notifications">,
        });
      } catch (e) {}
    }

    // 2. Rediriger immédiatement vers la page concernée
    const targetUrl = getNotificationTargetUrl(notif);
    router.push(targetUrl);
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    try {
      await markAllAsRead({ token });
      toast.success("Toutes les notifications sont marquées comme lues.");
    } catch (e) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "trip_started":
        return (
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-100 text-[#138872]">
            <Navigation className="h-5 w-5 stroke-[2.2]" />
          </div>
        );
      case "trip_reminder_45":
      case "trip_reminder_5":
        return (
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Clock className="h-5 w-5 stroke-[2.2]" />
          </div>
        );
      case "request_accepted":
        return (
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-5 w-5 stroke-[2.2]" />
          </div>
        );
      case "request_rejected":
      case "trip_cancelled":
        return (
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <XCircle className="h-5 w-5 stroke-[2.2]" />
          </div>
        );
      case "user_approved":
        return (
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
            <ShieldCheck className="h-5 w-5 stroke-[2.2]" />
          </div>
        );
      default:
        return (
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-100 text-[#175276]">
            <Car className="h-5 w-5 stroke-[2.2]" />
          </div>
        );
    }
  };

  const formatTime = (ts: number) => {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return "À l'instant";
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    return new Date(ts).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
  };

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  return (
    <div className="relative min-h-dvh bg-[#f4f7fb] text-slate-800 pb-28 select-none overflow-x-hidden">
      {/* Halos d'ambiance glassy */}
      <div className="pointer-events-none fixed -top-24 -right-24 h-96 w-96 rounded-full bg-teal-200/25 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-1/2 -left-28 h-80 w-80 rounded-full bg-blue-100/35 blur-3xl z-0" />

      {/* En-tête fixe glassy */}
      <div
        className="sticky top-0 z-30 glass-panel bg-white/80 backdrop-blur-2xl border-b border-white/80 px-4 pb-3.5 shadow-xs"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))" }}
      >
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => router.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 border border-slate-200/80 text-slate-700 hover:bg-white active:scale-95 transition-all shadow-xs"
              title="Retour"
            >
              <ChevronLeft className="h-5 w-5 stroke-[2.2]" />
            </button>
            <div>
              <h1 className="text-base font-black text-[#1a3860] tracking-tight flex items-center gap-2">
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="flex h-5 px-1.5 items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-black">
                    {unreadCount}
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-[#7d8fa5] font-medium">
                Mises à jour de vos trajets et de vos demandes
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#1a3860] text-xs font-bold transition-all flex items-center gap-1 active:scale-95"
              title="Tout marquer comme lu"
            >
              <CheckCheck className="h-3.5 w-3.5 text-teal-600" />
              <span className="hidden sm:inline">Tout lire</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-3 relative z-10">
        {/* Bannière d'activation des notifications mobiles si non encore autorisées */}
        {permissionState !== "granted" && (
          <div className="rounded-2xl glass-card bg-gradient-to-r from-blue-500/10 via-teal-500/10 to-emerald-500/10 border border-blue-200/80 p-3.5 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-[#175276] text-white shadow-xs">
                <BellRing className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#1a3860] leading-tight truncate">
                  Activer les alertes mobiles
                </p>
                <p className="text-[11px] text-[#5a708a] leading-tight mt-0.5">
                  Recevez les notifications sur votre téléphone
                </p>
              </div>
            </div>
            <button
              onClick={handleRequestPushPermission}
              disabled={isRequestingPermission}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-[#175276] hover:bg-[#134260] text-white text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1"
            >
              {isRequestingPermission ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>Activer</span>
            </button>
          </div>
        )}

        {/* Astuce iPhone : Nécessite l'ajout sur l'écran d'accueil pour le Web Push fermé */}
        {isIosBrowser && (
          <div className="rounded-2xl glass-card bg-amber-500/10 border border-amber-200/90 p-3.5 flex items-start gap-3 shadow-xs">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs mt-0.5">
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="flex-1 text-xs">
              <p className="font-bold text-[#1a3860]">
                Astuce iPhone / iPad :
              </p>
              <p className="text-[11px] text-[#5a708a] mt-0.5 leading-snug">
                Pour recevoir les alertes quand votre téléphone est verrouillé ou fermé, appuyez sur <Share2 className="inline h-3.5 w-3.5 mx-0.5 text-blue-600" /> <strong>Partager</strong> dans Safari, puis <strong>« Sur l'écran d'accueil »</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Liste des notifications */}
        {notifications === undefined ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-[#175276]" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-3xl glass-panel bg-white/90 p-8 text-center border border-white/90 shadow-sm space-y-2 mt-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mx-auto">
              <Bell className="h-6 w-6 stroke-[1.8]" />
            </div>
            <h3 className="text-sm font-bold text-[#1a3860]">Aucune notification</h3>
            <p className="text-xs text-[#7d8fa5] max-w-xs mx-auto">
              Vous serez notifié ici en temps réel lorsqu'un conducteur répondra ou qu'un trajet sera mis à jour.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {notifications.map((notif) => {
              const targetUrl = getNotificationTargetUrl(notif);
              const isUnread = !notif.isRead;

              return (
                <button
                  key={notif._id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left rounded-2xl p-3.5 border transition-all active:scale-[0.99] flex items-center gap-3 shadow-xs ${
                    isUnread
                      ? "glass-card bg-white/95 border-teal-200/90 shadow-[0_4px_16px_rgba(23,82,118,0.06)] ring-1 ring-teal-500/20"
                      : "bg-white/80 hover:bg-white border-white/90"
                  }`}
                >
                  <div className="flex-shrink-0">{getIcon(notif.type)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3
                        className={`text-xs truncate ${
                          isUnread
                            ? "font-black text-[#1a3860]"
                            : "font-bold text-slate-700"
                        }`}
                      >
                        {notif.title}
                      </h3>
                      <span className="text-[10px] text-[#7d8fa5] font-medium flex-shrink-0">
                        {formatTime(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#5a708a] mt-0.5 line-clamp-2 leading-snug">
                      {notif.body}
                    </p>

                    <div className="mt-1 flex items-center gap-1 text-[10px] text-[#175276] font-semibold">
                      <span>Voir les détails</span>
                      <ChevronRight className="h-3 w-3 stroke-[2.2]" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav userRole={user?.role ?? "user"} />
    </div>
  );
}
