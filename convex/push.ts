import { internalAction } from "./_generated/server";
import { v } from "convex/values";

/**
 * Action interne pour contacter l'API Web Push (VAPID) hébergée sur Vercel
 * et réveiller les smartphones des membres même si l'application est fermée
 */
export const dispatchPushNotifications = internalAction({
  args: {
    pushTokens: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.pushTokens || args.pushTokens.length === 0) return;

    // URL de l'application de production (ou locale si configurée)
    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://mon-trajet-gamma.vercel.app";

    try {
      const response = await fetch(`${appUrl}/api/push/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscriptions: args.pushTokens,
          title: args.title,
          body: args.body,
          url: args.url || "/",
        }),
      });

      if (!response.ok) {
        console.warn(`[WebPush] Statut réponse API : ${response.status}`);
      }
    } catch (error) {
      console.warn("[WebPush] Erreur d'envoi push distant :", error);
    }
  },
});
