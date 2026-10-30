import { MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { syncTripAvailableSeats } from "./trips";

/**
 * Calcul de distance en mètres selon la formule de Haversine
 */
export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Convertit un timestamp en date locale "YYYY-MM-DD"
 */
export function getLocalDateString(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calcule le timestamp Unix exact (ms) de fin d'une demande
 */
export function parseDemandEndTime(
  desiredDate?: string,
  desiredTimeSlot?: string,
  note?: string,
  createdAt: number = Date.now()
): number {
  // 1. Déterminer la date cible (YYYY-MM-DD)
  let dateStr = desiredDate;
  if (!dateStr && note) {
    const matchDate = note.match(/Date(?:\s*souhaitée)?\s*:\s*(\d{4}-\d{2}-\d{2})/i);
    if (matchDate) dateStr = matchDate[1];
  }
  if (!dateStr) {
    dateStr = getLocalDateString(createdAt);
  }

  const parts = dateStr.split("-").map(Number);
  const year = parts[0] || new Date().getFullYear();
  const month = parts[1] || new Date().getMonth() + 1;
  const day = parts[2] || new Date().getDate();

  // 2. Déterminer l'heure de fin à partir du créneau
  let slot = desiredTimeSlot;
  if (!slot && note) {
    const matchSlot = note.match(/Créneau\s*:\s*([^•\(\n\r]+)/i);
    if (matchSlot) slot = matchSlot[1].trim();
  }

  let endHour = 20; // Heure de fin par défaut (20h00) si non précisé
  let endMinute = 0;

  if (slot) {
    // Exemples : "08h - 10h", "08:30 - 10:45", "8h - 10h30", "14h - 24h"
    const dashMatch = slot.match(/-\s*(\d{1,2})(?:[h:](\d{1,2}))?/i);
    if (dashMatch) {
      endHour = parseInt(dashMatch[1], 10);
      endMinute = dashMatch[2] ? parseInt(dashMatch[2], 10) : 0;
    } else {
      const singleMatch = slot.match(/(\d{1,2})(?:[h:](\d{1,2}))?/i);
      if (singleMatch) {
        endHour = parseInt(singleMatch[1], 10);
        endMinute = singleMatch[2] ? parseInt(singleMatch[2], 10) : 0;
      }
    }
  }

  if (endHour >= 24) {
    endHour = 23;
    endMinute = 59;
  }

  const targetDate = new Date(year, month - 1, day, endHour, endMinute, 0, 0);
  return targetDate.getTime();
}

/**
 * Vérifie si un trajet correspond à une demande libre en termes de :
 * - Jour (même date "YYYY-MM-DD")
 * - Heure (heure de départ du conducteur compatible avec le créneau de la demande)
 * - Distance de détour (point de prise en charge dans le rayon toléré du conducteur)
 * - Places disponibles suffisantes
 */
export function isTripMatchingDemand(trip: any, demand: any): boolean {
  // 1. Un conducteur ne peut pas se récupérer lui-même
  if (trip.driverId === demand.passengerId) {
    return false;
  }

  // 2. Le nombre de places disponibles doit suffire
  if (trip.availableSeats < demand.seatsRequested) {
    return false;
  }

  // 3. Vérification du JOUR
  const tripDate = getLocalDateString(trip.departureTime);
  let demandDate = demand.desiredDate;
  if (!demandDate && demand.note) {
    const match = demand.note.match(/Date(?:\s*souhaitée)?\s*:\s*(\d{4}-\d{2}-\d{2})/i);
    if (match) demandDate = match[1];
  }
  if (!demandDate) {
    demandDate = getLocalDateString(demand.createdAt);
  }

  if (tripDate !== demandDate) {
    return false;
  }

  // 4. Vérification de l'HEURE
  const tripDateObj = new Date(trip.departureTime);
  const tripHour = tripDateObj.getHours() + tripDateObj.getMinutes() / 60;

  let slot = demand.desiredTimeSlot;
  if (!slot && demand.note) {
    const match = demand.note.match(/Créneau\s*:\s*([^•\(\n\r]+)/i);
    if (match) slot = match[1].trim();
  }

  if (slot) {
    const rangeMatch = slot.match(/(\d{1,2})(?:[h:](\d{1,2}))?\s*-\s*(\d{1,2})(?:[h:](\d{1,2}))?/i);
    if (rangeMatch) {
      const startH = parseInt(rangeMatch[1], 10) + (rangeMatch[2] ? parseInt(rangeMatch[2], 10) / 60 : 0);
      const endH = parseInt(rangeMatch[3], 10) + (rangeMatch[4] ? parseInt(rangeMatch[4], 10) / 60 : 0);

      // Tolérance de 15 minutes autour du créneau
      const isTimeCompatible = tripHour >= startH - 0.25 && tripHour <= endH + 0.25;
      if (!isTimeCompatible) {
        return false;
      }
    }
  }

  // 5. Vérification de la DISTANCE DE DÉTOUR
  const driverRadius = trip.pickupRadiusMeters ?? 500;

  // Distance directe conducteur départ -> passager prise en charge
  const distDepToPickup = getDistanceMeters(
    trip.departureLocation.lat,
    trip.departureLocation.lng,
    demand.pickupLocation.lat,
    demand.pickupLocation.lng
  );

  // Détour réel sur l'itinéraire (Départ -> Prise en charge -> Destination vs Départ -> Destination)
  const distDirect = getDistanceMeters(
    trip.departureLocation.lat,
    trip.departureLocation.lng,
    trip.destinationLocation.lat,
    trip.destinationLocation.lng
  );
  const distPickupToDest = getDistanceMeters(
    demand.pickupLocation.lat,
    demand.pickupLocation.lng,
    trip.destinationLocation.lat,
    trip.destinationLocation.lng
  );
  const extraDetour = Math.max(0, distDepToPickup + distPickupToDest - distDirect);

  // Le passager est accepté si :
  // - Son point de départ est dans le rayon du conducteur (<= driverRadius)
  // - OU le détour supplémentaire induit sur l'itinéraire est dans le rayon toléré (<= driverRadius)
  const isDetourAcceptable = distDepToPickup <= driverRadius || extraDetour <= driverRadius;

  if (!isDetourAcceptable) {
    return false;
  }

  // 6. Vérification de la DESTINATION (si précisée par le passager)
  if (demand.destinationLocation && demand.destinationLocation.address) {
    const isChurchDestination =
      demand.destinationLocation.address.toLowerCase().includes("église") ||
      demand.destinationLocation.address.toLowerCase().includes("eglise") ||
      trip.destinationLocation.address.toLowerCase().includes("église") ||
      trip.destinationLocation.address.toLowerCase().includes("eglise");

    if (!isChurchDestination) {
      const distDest = getDistanceMeters(
        demand.destinationLocation.lat,
        demand.destinationLocation.lng,
        trip.destinationLocation.lat,
        trip.destinationLocation.lng
      );
      if (distDest > Math.max(driverRadius, 2500)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Quand un conducteur publie un trajet, associe directement les demandes libres compatibles
 * et les envoie au conducteur pour validation.
 */
export async function matchTripWithOpenDemands(ctx: MutationCtx, tripId: Id<"trips">) {
  const trip = await ctx.db.get(tripId);
  if (!trip || trip.status !== "planned" || trip.availableSeats <= 0) return;

  const driver = await ctx.db.get(trip.driverId);
  if (!driver) return;

  // Récupérer toutes les demandes libres non encore reliées à un trajet
  const pendingRequests = await ctx.db
    .query("requests")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .collect();

  const unassignedDemands = pendingRequests.filter((r) => !r.tripId);
  let remainingSeats = trip.availableSeats;

  for (const demand of unassignedDemands) {
    if (remainingSeats < demand.seatsRequested) continue;

    const matches = isTripMatchingDemand(
      { ...trip, availableSeats: remainingSeats },
      demand
    );

    if (matches) {
      // 1. Associer directement la demande au trajet
      await ctx.db.patch(demand._id, {
        tripId: trip._id,
        status: "pending",
      });

      remainingSeats -= demand.seatsRequested;

      const passenger = await ctx.db.get(demand.passengerId);
      const passengerName = passenger?.name || "Un membre";

      // 2. Notification envoyée au conducteur
      await ctx.db.insert("notifications", {
        userId: trip.driverId,
        title: "Demande associée à votre trajet 🚗",
        body: `${passengerName} recherche ${demand.seatsRequested} place(s) sur votre itinéraire. Sa demande a été automatiquement rattachée à votre trajet.`,
        type: "request_received",
        relatedTripId: trip._id,
        relatedRequestId: demand._id,
        link: `/trips/${trip._id}`,
        isRead: false,
        createdAt: Date.now(),
      });

      if (driver.pushToken) {
        await ctx.scheduler.runAfter(0, internal.push.dispatchPushNotifications, {
          pushTokens: [driver.pushToken],
          title: "Demande associée à votre trajet 🚗",
          body: `${passengerName} recherche ${demand.seatsRequested} place(s) sur votre itinéraire.`,
          url: `/trips/${trip._id}`,
        });
      }

      // 3. Notification envoyée au passager
      await ctx.db.insert("notifications", {
        userId: demand.passengerId,
        title: "Trajet trouvé pour votre demande ! 🎉",
        body: `${driver.name} a publié un trajet correspondant à votre besoin. Votre demande lui a été transmise.`,
        type: "request_received",
        relatedTripId: trip._id,
        relatedRequestId: demand._id,
        link: `/trips/${trip._id}`,
        isRead: false,
        createdAt: Date.now(),
      });

      if (passenger?.pushToken) {
        await ctx.scheduler.runAfter(0, internal.push.dispatchPushNotifications, {
          pushTokens: [passenger.pushToken],
          title: "Trajet trouvé ! 🎉",
          body: `${driver.name} propose un trajet correspondant. Votre demande lui a été transmise.`,
          url: `/trips/${trip._id}`,
        });
      }
    }
  }

  // Mettre à jour les places du trajet
  await syncTripAvailableSeats(ctx, trip._id);
}

/**
 * Quand une personne publie une demande libre, recherche si un trajet planifié
 * correspond déjà pour l'associer immédiatement.
 */
export async function matchOpenDemandWithPlannedTrips(
  ctx: MutationCtx,
  requestId: Id<"requests">
) {
  const demand = await ctx.db.get(requestId);
  if (!demand || demand.tripId || demand.status !== "pending") return;

  const passenger = await ctx.db.get(demand.passengerId);
  if (!passenger) return;

  // Récupérer les trajets planifiés actifs
  const plannedTrips = await ctx.db
    .query("trips")
    .withIndex("by_status", (q) => q.eq("status", "planned"))
    .collect();

  for (const trip of plannedTrips) {
    if (trip.availableSeats < demand.seatsRequested) continue;

    if (isTripMatchingDemand(trip, demand)) {
      const driver = await ctx.db.get(trip.driverId);
      if (!driver) continue;

      // Associer la demande
      await ctx.db.patch(demand._id, {
        tripId: trip._id,
        status: "pending",
      });

      // Synchroniser les places
      await syncTripAvailableSeats(ctx, trip._id);

      // Notifier le conducteur
      await ctx.db.insert("notifications", {
        userId: trip.driverId,
        title: "Demande associée à votre trajet 🚗",
        body: `${passenger.name} recherche ${demand.seatsRequested} place(s) sur votre itinéraire. Sa demande a été automatiquement rattachée à votre trajet.`,
        type: "request_received",
        relatedTripId: trip._id,
        relatedRequestId: demand._id,
        link: `/trips/${trip._id}`,
        isRead: false,
        createdAt: Date.now(),
      });

      if (driver.pushToken) {
        await ctx.scheduler.runAfter(0, internal.push.dispatchPushNotifications, {
          pushTokens: [driver.pushToken],
          title: "Demande associée à votre trajet 🚗",
          body: `${passenger.name} recherche ${demand.seatsRequested} place(s) sur votre itinéraire.`,
          url: `/trips/${trip._id}`,
        });
      }

      // Notifier le passager
      await ctx.db.insert("notifications", {
        userId: demand.passengerId,
        title: "Trajet trouvé pour votre demande ! 🎉",
        body: `${driver.name} propose un trajet correspondant. Votre demande lui a été transmise pour validation.`,
        type: "request_received",
        relatedTripId: trip._id,
        relatedRequestId: demand._id,
        link: `/trips/${trip._id}`,
        isRead: false,
        createdAt: Date.now(),
      });

      if (passenger.pushToken) {
        await ctx.scheduler.runAfter(0, internal.push.dispatchPushNotifications, {
          pushTokens: [passenger.pushToken],
          title: "Trajet trouvé ! 🎉",
          body: `${driver.name} propose un trajet correspondant. Votre demande lui a été transmise.`,
          url: `/trips/${trip._id}`,
        });
      }

      break;
    }
  }
}

/**
 * Cycle de vie des demandes ouvertes (exécuté périodiquement par le Cron) :
 * 1. À 30 min de la fin de la demande : envoi de la notification d'encouragement
 * 2. 30 min après la fin de la demande : suppression de la demande et notification d'invalidation
 */
export async function processOpenDemandsLifecycle(ctx: MutationCtx) {
  const now = Date.now();

  const openRequests = await ctx.db
    .query("requests")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .collect();

  const unassignedRequests = openRequests.filter((r) => !r.tripId);

  for (const req of unassignedRequests) {
    const endTimestamp = parseDemandEndTime(
      req.desiredDate,
      req.desiredTimeSlot,
      req.note,
      req.createdAt
    );

    const passenger = await ctx.db.get(req.passengerId);
    if (!passenger) continue;

    // 1. 30 minutes après la fin de la demande : la demande est enlevée et notification d'invalidation
    if (now >= endTimestamp + 30 * 60 * 1000) {
      await ctx.db.delete(req._id);

      await ctx.db.insert("notifications", {
        userId: req.passengerId,
        title: "Demande expirée",
        body: "Votre demande de trajet n'est plus valide car le créneau horaire est dépassé.",
        type: "demand_expired",
        link: "/needs?tab=my",
        isRead: false,
        createdAt: now,
      });

      if (passenger.pushToken) {
        await ctx.scheduler.runAfter(0, internal.push.dispatchPushNotifications, {
          pushTokens: [passenger.pushToken],
          title: "Demande expirée ⌛",
          body: "Votre demande de trajet n'est plus valide car le créneau horaire est dépassé.",
          url: "/needs?tab=my",
        });
      }
      continue;
    }

    // 2. À 30 minutes de la fin de la demande : notification "aucun conducteur n'a répondu mais espérer toujours"
    if (now >= endTimestamp - 30 * 60 * 1000 && !req.reminder30MinSent) {
      await ctx.db.patch(req._id, { reminder30MinSent: true });

      await ctx.db.insert("notifications", {
        userId: req.passengerId,
        title: "Votre demande de trajet",
        body: "Pour le moment aucun conducteur n'a répondu à votre demande, mais gardez espoir ! Des trajets peuvent encore être publiés.",
        type: "demand_reminder_30",
        relatedRequestId: req._id,
        link: `/requests/${req._id}`,
        isRead: false,
        createdAt: now,
      });

      if (passenger.pushToken) {
        await ctx.scheduler.runAfter(0, internal.push.dispatchPushNotifications, {
          pushTokens: [passenger.pushToken],
          title: "Demande en attente ⏳",
          body: "Pour le moment aucun conducteur n'a répondu à votre demande, mais gardez espoir !",
          url: `/requests/${req._id}`,
        });
      }
    }
  }
}
