export interface NotificationRouteTarget {
  type: string;
  relatedTripId?: string;
  relatedRequestId?: string;
  link?: string;
}

/**
 * Calcule l'URL de redirection exacte lors du clic sur une notification
 * (qu'il s'agisse d'un clic sur la notification système du téléphone ou dans l'app)
 */
export function getNotificationTargetUrl(notif: NotificationRouteTarget): string {
  // Le rappel à 5 min ouvre obligatoirement la page d'accueil
  if (notif.type === "trip_reminder_5") {
    return "/";
  }
  if (notif.link && notif.link.trim().length > 0) {
    return notif.link;
  }
  if (notif.relatedTripId) {
    return `/trips/${notif.relatedTripId}`;
  }
  if (notif.relatedRequestId) {
    return `/requests/${notif.relatedRequestId}`;
  }
  if (notif.type === "request_rejected") {
    return "/needs";
  }
  if (notif.type === "user_approved") {
    return "/profile";
  }
  if (notif.type === "trip_cancelled") {
    return "/trips";
  }
  return "/notifications";
}
