"use client";

import React, { useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/ToastProvider";
import { getNotificationTargetUrl } from "@/lib/notification-routes";

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

  // Vérification périodique des rappels (45 min et 5 min) côté client
  useEffect(() => {
    if (!token) return;
    const runCheck = async () => {
      try {
        await triggerRemindersCheck({ token });
      } catch (e) {
        // Ignorer silencieusement les erreurs de timing réseau
      }
    };
    runCheck();
    const interval = setInterval(runCheck, 30000);
    return () => clearInterval(interval);
  }, [token, triggerRemindersCheck]);

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

          // A. Afficher la notification native sur le téléphone (Notification API / Service Worker)
          if (
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
                  } as NotificationOptions);
                })
                .catch(() => {
                  // Fallback direct Notification
                  try {
                    const n = new Notification(notif.title, {
                      body: notif.body,
                      icon: "/icons/icon-192x192.png",
                      data: { url: targetUrl },
                    });
                    n.onclick = () => {
                      window.focus();
                      router.push(targetUrl);
                      n.close();
                    };
                  } catch (e) {}
                });
            }

            if ("vibrate" in navigator) {
              try {
                navigator.vibrate([200, 100, 200]);
              } catch (e) {}
            }
          }

          // B. Alerte in-app fluide en bas de l'écran
          toast.info(`${notif.title} : ${notif.body}`);
        } catch (err) {
          console.warn("Erreur affichage notification:", err);
        }
      }
    }
  }, [notifications, router, toast]);

  return null;
}
