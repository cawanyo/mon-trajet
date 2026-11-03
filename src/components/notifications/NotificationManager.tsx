"use client";

import React, { useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/ToastProvider";
import { getNotificationTargetUrl } from "@/lib/notification-routes";
import { registerServiceWorkerAndSubscribe } from "@/lib/push-notifications";

export function NotificationManager() {
  const { token, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const isInitializedRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // 1. Enregistrement automatique du Service Worker pour PWA & Caching
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Mise à jour automatique si un nouveau service worker est en attente
          if (reg.waiting) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        })
        .catch((err) => {
          console.warn("Échec de l'enregistrement du Service Worker :", err);
        });
    }
  }, []);

  // 2. Écoute réactive en temps réel des notifications de l'utilisateur
  const notifications = useQuery(
    api.users.getMyNotifications,
    token ? { token } : "skip"
  );
  const triggerRemindersCheck = useMutation(api.trips.checkAndSendTripReminders);
  const triggerOpenDemandsCheck = useMutation(api.requests.processOpenDemandsLifecycleMutation);
  const updatePushToken = useMutation(api.users.updatePushToken);

  // Demande automatique de la permission de notifications dès l'arrivée sur l'application (comme pour la localisation)
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "default") {
      registerServiceWorkerAndSubscribe().then((subStr) => {
        if (subStr && token) {
          updatePushToken({ token, pushToken: subStr }).catch(() => {});
        }
      }).catch(() => {});
    } else if (Notification.permission === "granted" && token) {
      registerServiceWorkerAndSubscribe().then((subStr) => {
        if (subStr) {
          updatePushToken({ token, pushToken: subStr }).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [token, updatePushToken]);

  // Vérification périodique des rappels trajets et du cycle de vie des demandes ouvertes
  useEffect(() => {
    if (!token) return;
    const runCheck = async () => {
      try {
        await Promise.all([
          triggerRemindersCheck({ token }).catch(() => {}),
          triggerOpenDemandsCheck({ token }).catch(() => {}),
        ]);
      } catch (e) {
        // Ignorer silencieusement les erreurs de timing réseau
      }
    };
    runCheck();
    const interval = setInterval(runCheck, 30000);
    return () => clearInterval(interval);
  }, [token, triggerRemindersCheck, triggerOpenDemandsCheck]);

  useEffect(() => {
    if (!notifications || notifications.length === 0) return;

    // Au premier chargement de la session, mémoriser les notifications existantes
    // pour éviter de spammer d'anciennes alertes
    if (!isInitializedRef.current) {
      for (const n of notifications) {
        seenIdsRef.current.add(n._id);
      }
      isInitializedRef.current = true;
      return;
    }

    // Détection des NOUVELLES notifications non lues arrivées en temps réel
    for (const notif of notifications) {
      if (!seenIdsRef.current.has(notif._id) && !notif.isRead) {
        seenIdsRef.current.add(notif._id);

        try {
          const targetUrl = getNotificationTargetUrl(notif);

          // A. Alerte in-app fluide en bas de l'écran (toujours active pour avertir l'utilisateur dans l'interface)
          toast.info(`${notif.title} : ${notif.body}`);

          // B. Notification système native sur le téléphone :
          // Uniquement si l'application est en arrière-plan (non visible) pour éviter tout doublon avec le toast et le Web Push
          const isPageVisible =
            typeof document !== "undefined" && document.visibilityState === "visible";

          if (
            !isPageVisible &&
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            if ("serviceWorker" in navigator) {
              navigator.serviceWorker.ready
                .then((reg) => {
                  reg.showNotification(notif.title, {
                    body: notif.body,
                    icon: "/icons/icon-192x192.png",
                    badge: "/icons/icon-192x192.png",
                    vibrate: [200, 100, 200],
                    data: { url: targetUrl },
                    tag: notif._id,
                    renotify: false,
                  } as NotificationOptions);
                })
                .catch(() => {
                  // Fallback direct Notification
                  try {
                    const n = new Notification(notif.title, {
                      body: notif.body,
                      icon: "/icons/icon-192x192.png",
                      data: { url: targetUrl },
                      tag: notif._id,
                    });
                    n.onclick = () => {
                      window.focus();
                      router.push(targetUrl);
                      n.close();
                    };
                  } catch (e) {}
                });
            }
          }
        } catch (err) {
          console.warn("Erreur affichage notification:", err);
        }
      }
    }
  }, [notifications, router, toast]);

  return null;
}
