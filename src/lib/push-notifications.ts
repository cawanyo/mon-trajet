// Helper d'enregistrement Web Push API pour PWA et réveil du téléphone application fermée
import { VAPID_PUBLIC_KEY } from "@/lib/vapid-keys";

export async function registerServiceWorkerAndSubscribe(): Promise<string | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Les notifications Web Push ne sont pas supportées par ce navigateur.");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // Demande de permission
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      return null;
    }

    // Récupération ou création de la souscription Web Push avec la clé publique VAPID
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    return subscription ? JSON.stringify(subscription) : null;
  } catch (error) {
    console.error("Erreur lors de l'enregistrement Web Push :", error);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
