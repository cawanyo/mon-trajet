import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } from "@/lib/vapid-keys";

// Configuration des clés VAPID serveur
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (e) {
  console.warn("Erreur configuration VAPID webpush :", e);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscriptions, title, body: messageBody, url } = body;

    const subsList: any[] = [];

    if (Array.isArray(subscriptions)) {
      for (const s of subscriptions) {
        if (!s) continue;
        try {
          subsList.push(typeof s === "string" ? JSON.parse(s) : s);
        } catch (e) {}
      }
    } else if (body.pushToken) {
      try {
        subsList.push(typeof body.pushToken === "string" ? JSON.parse(body.pushToken) : body.pushToken);
      } catch (e) {}
    }

    if (subsList.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: "Aucune souscription valide fournie" });
    }

    const payload = JSON.stringify({
      title: title || "Mon Trajet Église",
      body: messageBody || "Nouvelle mise à jour de votre trajet.",
      url: url || "/",
    });

    let sent = 0;
    const errors: any[] = [];

    await Promise.allSettled(
      subsList.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, payload, {
            TTL: 60 * 60 * 24, // 24 heures
            urgency: "high",
          });
          sent++;
        } catch (err: any) {
          // Si le token est expiré (410 Gone / 404 Not Found), le terminal push l'a révoqué
          errors.push(err?.statusCode || err?.message);
        }
      })
    );

    return NextResponse.json({ success: true, sent, attempted: subsList.length, errors });
  } catch (error: any) {
    console.error("Erreur API /api/push/send :", error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
