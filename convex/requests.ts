import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthenticatedUser } from "./auth";
import { syncTripAvailableSeats } from "./trips";
import {
  matchOpenDemandWithPlannedTrips,
  processOpenDemandsLifecycle,
} from "./matching";

// 1. Créer une demande de place ou un signal de besoin ouvert
export const createRequest = mutation({
  args: {
    token: v.optional(v.string()),
    tripId: v.optional(v.id("trips")),
    pickupLocation: v.object({
      lat: v.number(),
      lng: v.number(),
      address: v.string(),
    }),
    destinationLocation: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
        address: v.string(),
      })
    ),
    seatsRequested: v.number(),
    desiredDate: v.optional(v.string()),
    desiredTimeSlot: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) throw new Error("Authentification requise.");
    if (user.status === "rejected") {
      throw new Error("Votre compte n'est pas autorisé à effectuer une demande.");
    }

    if (args.seatsRequested <= 0) {
      throw new Error("Vous devez demander au moins 1 place.");
    }

    // Assurer une adresse propre sans terme générique type 'Ma position GPS'
    let cleanAddress = args.pickupLocation.address.trim();
    if (
      !cleanAddress ||
      cleanAddress.toLowerCase().includes("ma position") ||
      cleanAddress.toLowerCase().includes("position gps") ||
      cleanAddress.toLowerCase() === "position"
    ) {
      cleanAddress = `Secteur (${args.pickupLocation.lat.toFixed(4)}, ${args.pickupLocation.lng.toFixed(4)})`;
    }

    const sanitizedPickup = {
      ...args.pickupLocation,
      address: cleanAddress,
    };

    if (args.tripId) {
      const trip = await ctx.db.get(args.tripId);
      if (!trip) throw new Error("Trajet introuvable.");

      if (trip.driverId === user._id) {
        throw new Error("Vous êtes déjà le conducteur de ce véhicule.");
      }

      if (trip.availableSeats < args.seatsRequested) {
        throw new Error("Il n'y a plus assez de places disponibles sur ce trajet.");
      }

      const existing = await ctx.db
        .query("requests")
        .withIndex("by_passenger", (q) => q.eq("passengerId", user._id))
        .filter((q) => q.eq(q.field("tripId"), args.tripId))
        .first();

      if (existing && existing.status !== "cancelled" && existing.status !== "rejected") {
        throw new Error("Une demande est déjà en cours pour ce trajet.");
      }

      const requestId = await ctx.db.insert("requests", {
        passengerId: user._id,
        tripId: args.tripId,
        pickupLocation: sanitizedPickup,
        destinationLocation: args.destinationLocation,
        status: "pending",
        seatsRequested: args.seatsRequested,
        desiredDate: args.desiredDate,
        desiredTimeSlot: args.desiredTimeSlot,
        note: args.note,
        createdAt: Date.now(),
      });

      // La place demandée n'est plus disponible : mise à jour immédiate
      await syncTripAvailableSeats(ctx, trip._id);

      await ctx.db.insert("notifications", {
        userId: trip.driverId,
        title: "Nouvelle demande de covoiturage",
        body: `${user.name} a demandé ${args.seatsRequested} place(s) sur votre trajet.`,
        type: "request_received",
        relatedTripId: trip._id,
        isRead: false,
        createdAt: Date.now(),
      });

      return requestId;
    }

    // Cas "Signal de besoin" ouvert sur la carte
    const requestId = await ctx.db.insert("requests", {
      passengerId: user._id,
      pickupLocation: sanitizedPickup,
      destinationLocation: args.destinationLocation,
      status: "pending",
      seatsRequested: args.seatsRequested,
      desiredDate: args.desiredDate,
      desiredTimeSlot: args.desiredTimeSlot,
      note: args.note,
      createdAt: Date.now(),
    });

    // Rechercher immédiatement si un trajet planifié correspond (jour, heure, détour)
    try {
      await matchOpenDemandWithPlannedTrips(ctx, requestId);
    } catch (e) {
      console.warn("Erreur auto-matching trajet existant :", e);
    }

    return requestId;
  },
});

// 2. Récupérer les "Besoins" ouverts en temps réel pour la carte
export const listOpenNeeds = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx) => {
    const openRequests = await ctx.db
      .query("requests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const unassigned = openRequests.filter((r) => !r.tripId);

    return await Promise.all(
      unassigned.map(async (req) => {
        const passenger = await ctx.db.get(req.passengerId);
        return {
          ...req,
          passenger: passenger
            ? {
                _id: passenger._id,
                name: passenger.name,
                avatarUrl: passenger.avatarUrl,
                status: passenger.status, // Statut de validation pour le ticker
                // Téléphone strictement masqué
              }
            : null,
        };
      })
    );
  },
});

// 3. Répondre à une demande de trajet (Accepter ou Refuser)
export const respondToRequest = mutation({
  args: {
    token: v.optional(v.string()),
    requestId: v.id("requests"),
    decision: v.union(v.literal("accepted"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) throw new Error("Authentification requise.");

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Demande introuvable.");

    if (!request.tripId) {
      throw new Error("Cette demande n'est pas encore associée à un trajet.");
    }

    const trip = await ctx.db.get(request.tripId);
    if (!trip) throw new Error("Trajet associé introuvable.");

    if (trip.driverId !== user._id) {
      throw new Error("Seul le conducteur peut répondre à cette demande.");
    }

    if (request.status !== "pending") {
      throw new Error("Cette demande a déjà été traitée ou annulée.");
    }

    if (args.decision === "accepted") {
      // Mettre à jour le statut -> DÉBLOQUE LE TÉLÉPHONE
      await ctx.db.patch(request._id, {
        status: "accepted",
      });

      // Synchroniser les places (les places restent réservées)
      await syncTripAvailableSeats(ctx, trip._id);

      // Notifier le passager
      await ctx.db.insert("notifications", {
        userId: request.passengerId,
        title: "Demande acceptée 🎉",
        body: `${user.name} a accepté votre demande. Vous pouvez maintenant l'appeler pour coordonner le départ.`,
        type: "request_accepted",
        relatedTripId: trip._id,
        isRead: false,
        createdAt: Date.now(),
      });
    } else {
      // Le conducteur refuse la demande ("rejected") -> libère immédiatement la place !
      await ctx.db.patch(request._id, {
        status: "rejected",
      });

      // Synchroniser les places (la place est libérée)
      await syncTripAvailableSeats(ctx, trip._id);

      await ctx.db.insert("notifications", {
        userId: request.passengerId,
        title: "Demande non retenue",
        body: `Votre demande pour le trajet n'a pas pu être acceptée.`,
        type: "request_rejected",
        relatedTripId: trip._id,
        isRead: false,
        createdAt: Date.now(),
      });
    }
  },
});

// 4. Proposer de récupérer un passager ayant émis un signal de besoin
export const matchOpenNeedToTrip = mutation({
  args: {
    token: v.optional(v.string()),
    requestId: v.id("requests"),
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) throw new Error("Authentification requise.");

    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "pending") {
      throw new Error("Demande invalide.");
    }

    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.driverId !== user._id) {
      throw new Error("Trajet invalide.");
    }

    if (trip.availableSeats < request.seatsRequested) {
      throw new Error("Votre véhicule n'a pas assez de places.");
    }

    await ctx.db.patch(request._id, {
      tripId: trip._id,
      status: "accepted",
    });

    await syncTripAvailableSeats(ctx, trip._id);

    await ctx.db.insert("notifications", {
      userId: request.passengerId,
      title: "Un conducteur vous récupère ! 🚗",
      body: `${user.name} a accepté de vous prendre en charge. Vous avez maintenant accès à son numéro pour l'appeler.`,
      type: "request_accepted",
      relatedTripId: trip._id,
      isRead: false,
      createdAt: Date.now(),
    });
  },
});

// 4b. Créer automatiquement un trajet depuis la position du conducteur vers la destination du demandeur
export const proposePickUpAndCreateTrip = mutation({
  args: {
    token: v.optional(v.string()),
    requestId: v.id("requests"),
    departureTime: v.optional(v.number()),
    driverLocation: v.object({
      lat: v.number(),
      lng: v.number(),
      address: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) throw new Error("Authentification requise.");
    if (user.status === "rejected") {
      throw new Error("Votre compte n'est pas autorisé à proposer un trajet.");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "pending") {
      throw new Error("Cette demande n'est plus disponible ou a déjà été prise en charge.");
    }

    if (request.passengerId === user._id) {
      throw new Error("Vous ne pouvez pas accepter votre propre demande.");
    }

    // Récupération de la destination du demandeur ou église par défaut
    let destination = request.destinationLocation;
    if (!destination || !destination.address) {
      const churchSettings = await ctx.db.query("churchSettings").first();
      destination = {
        lat: churchSettings?.lat ?? 48.8566,
        lng: churchSettings?.lng ?? 2.3522,
        address: churchSettings?.address ?? "Église (Centre-ville)",
      };
    }

    // Assurer une adresse de départ propre sans libellé GPS générique
    let cleanDriverAddress = args.driverLocation.address.trim();
    if (
      !cleanDriverAddress ||
      cleanDriverAddress.toLowerCase().includes("ma position") ||
      cleanDriverAddress.toLowerCase().includes("gps")
    ) {
      cleanDriverAddress = `Position du conducteur (${args.driverLocation.lat.toFixed(4)}, ${args.driverLocation.lng.toFixed(4)})`;
    }

    // Le nombre de places dans le trajet généré doit être égal au nombre de places demandé
    const seatsReq = Math.max(1, request.seatsRequested || 1);
    const totalSeats = seatsReq;
    const availableSeats = 0; // Le passager occupe toutes les places réservées de ce trajet

    // Heure choisie par le conducteur (ou dans 15 min par défaut)
    const departureTime = args.departureTime ?? (Date.now() + 15 * 60 * 1000);

    // 1. Créer le trajet
    const tripId = await ctx.db.insert("trips", {
      driverId: user._id,
      departureLocation: {
        lat: args.driverLocation.lat,
        lng: args.driverLocation.lng,
        address: cleanDriverAddress,
      },
      destinationLocation: {
        lat: destination.lat,
        lng: destination.lng,
        address: destination.address,
      },
      departureTime,
      totalSeats,
      availableSeats,
      pickupRadiusMeters: user.preferences?.preferredDetourRadius ?? 500,
      status: "planned",
      notes: "Trajet créé pour récupérer un passager",
      createdAt: Date.now(),
    });

    // 2. Associer la demande au trajet et l'accepter immédiatement
    await ctx.db.patch(request._id, {
      tripId,
      status: "accepted",
    });

    // 3. Notifier le passager avec l'heure de départ choisie
    const formattedHour = new Date(departureTime).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    await ctx.db.insert("notifications", {
      userId: request.passengerId,
      title: "Un conducteur vient vous récupérer ! 🚗",
      body: `${user.name} a créé un trajet pour vous prendre en charge (départ prévu à ${formattedHour}).`,
      type: "request_accepted",
      relatedTripId: tripId,
      isRead: false,
      createdAt: Date.now(),
    });

    return tripId;
  },
});

// 5. Annuler une demande côté passager (libère automatiquement les places chez le conducteur et la supprime de la vue du demandeur)
export const cancelPassengerRequest = mutation({
  args: {
    token: v.optional(v.string()),
    requestId: v.id("requests"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) throw new Error("Authentification requise.");

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      return { success: true, message: "Demande déjà annulée ou introuvable." };
    }

    // Seul le passager concerné ou un admin peut annuler sa demande
    if (request.passengerId !== user._id && user.role !== "admin") {
      throw new Error("Vous n'êtes pas autorisé à annuler cette demande.");
    }

    const wasActive = request.status === "accepted" || request.status === "pending";
    const tripId = request.tripId;
    const seatsRequested = request.seatsRequested || 1;

    // Supprimer la demande pour qu'elle disparaisse complètement chez le demandeur
    await ctx.db.delete(request._id);

    // Si la demande était active et rattachée à un trajet, libérer immédiatement les places chez le conducteur et le notifier
    if (wasActive && tripId) {
      await syncTripAvailableSeats(ctx, tripId);
      const trip = await ctx.db.get(tripId);
      if (trip) {
        // 1. Notifier le conducteur dans l'application
        await ctx.db.insert("notifications", {
          userId: trip.driverId,
          title: "Désistement d'un passager",
          body: `${user.name} a annulé sa réservation (${seatsRequested} place${seatsRequested > 1 ? "s" : ""} libérée${seatsRequested > 1 ? "s" : ""}).`,
          type: "trip_cancelled",
          relatedTripId: trip._id,
          isRead: false,
          createdAt: Date.now(),
        });

        // 2. Notifier le conducteur via Web Push (notification réelle sur son téléphone)
        const driver = await ctx.db.get(trip.driverId);
        if (driver?.pushToken) {
          await ctx.scheduler.runAfter(0, internal.push.dispatchPushNotifications, {
            pushTokens: [driver.pushToken],
            title: "Désistement d'un passager 🚗",
            body: `${user.name} a annulé sa réservation (${seatsRequested} place${seatsRequested > 1 ? "s" : ""} libérée${seatsRequested > 1 ? "s" : ""}).`,
            url: `/trips/${trip._id}`,
          });
        }
      }
    }

    return { success: true };
  },
});

// 6. Récupérer les détails d'une demande (libre ou associée à un trajet)
export const getRequestDetails = query({
  args: {
    token: v.optional(v.string()),
    requestId: v.id("requests"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    const request = await ctx.db.get(args.requestId);
    if (!request) return null;

    const passenger = await ctx.db.get(request.passengerId);
    let trip = null;
    let driver = null;

    if (request.tripId) {
      trip = await ctx.db.get(request.tripId);
      if (trip) {
        const driverDoc = await ctx.db.get(trip.driverId);
        if (driverDoc) {
          driver = {
            _id: driverDoc._id,
            name: driverDoc.name,
            avatarUrl: driverDoc.avatarUrl,
            status: driverDoc.status,
            phoneNumber: request.status === "accepted" ? driverDoc.phoneNumber : null,
          };
        }
      }
    }

    return {
      ...request,
      passenger: passenger
        ? {
            _id: passenger._id,
            name: passenger.name,
            avatarUrl: passenger.avatarUrl,
            status: passenger.status,
            phoneNumber: user ? passenger.phoneNumber : null,
          }
        : null,
      trip,
      driver,
      isOwner: user ? user._id === request.passengerId : false,
    };
  },
});

// 7. Modifier une demande libre
export const updateRequest = mutation({
  args: {
    token: v.optional(v.string()),
    requestId: v.id("requests"),
    pickupLocation: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
        address: v.string(),
      })
    ),
    destinationLocation: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
        address: v.string(),
      })
    ),
    seatsRequested: v.optional(v.number()),
    desiredDate: v.optional(v.string()),
    desiredTimeSlot: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) throw new Error("Authentification requise.");

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Demande introuvable.");

    if (request.passengerId !== user._id && user.role !== "admin") {
      throw new Error("Vous n'êtes pas autorisé à modifier cette demande.");
    }

    if (request.status === "cancelled") {
      throw new Error("Impossible de modifier une demande déjà annulée.");
    }

    const updates: any = {};
    if (args.pickupLocation) {
      let cleanAddress = args.pickupLocation.address.trim();
      if (
        !cleanAddress ||
        cleanAddress.toLowerCase().includes("ma position") ||
        cleanAddress.toLowerCase().includes("position gps") ||
        cleanAddress.toLowerCase() === "position"
      ) {
        cleanAddress = `Secteur (${args.pickupLocation.lat.toFixed(4)}, ${args.pickupLocation.lng.toFixed(4)})`;
      }
      updates.pickupLocation = {
        ...args.pickupLocation,
        address: cleanAddress,
      };
    }
    if (args.destinationLocation) {
      updates.destinationLocation = args.destinationLocation;
    }
    if (args.seatsRequested !== undefined) {
      if (args.seatsRequested <= 0) {
        throw new Error("Le nombre de places doit être d'au moins 1.");
      }
      updates.seatsRequested = args.seatsRequested;
    }
    if (args.note !== undefined) {
      updates.note = args.note;
    }
    if (args.desiredDate !== undefined) {
      updates.desiredDate = args.desiredDate;
    }
    if (args.desiredTimeSlot !== undefined) {
      updates.desiredTimeSlot = args.desiredTimeSlot;
    }

    await ctx.db.patch(request._id, updates);

    if (request.tripId && (request.status === "pending" || request.status === "accepted")) {
      await syncTripAvailableSeats(ctx, request.tripId);
    }

    return { success: true };
  },
});

// 8. Lister les "Demandes" avec séparation "Mes demandes" et "Autres demandes"
export const listDemands = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);

    // 1. "Autres demandes" : Uniquement les demandes NON associées à un trajet émanant d'autres membres
    const pendingRequests = await ctx.db
      .query("requests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();

    // Filtre strict : strictement sans trajet et ne provenant pas de l'utilisateur courant
    const otherDemandsRaw = pendingRequests.filter(
      (r) => !r.tripId && (!user || r.passengerId !== user._id)
    );

    const otherDemands = await Promise.all(
      otherDemandsRaw.map(async (req) => {
        const passenger = await ctx.db.get(req.passengerId);
        return {
          ...req,
          passenger: passenger
            ? {
                _id: passenger._id,
                name: passenger.name,
                avatarUrl: passenger.avatarUrl,
                status: passenger.status,
              }
            : null,
        };
      })
    );

    // 2. "Mes demandes" : Mes alertes et demandes non encore acceptées par un conducteur
    let myDemands: any[] = [];
    if (user) {
      const myRequests = await ctx.db
        .query("requests")
        .withIndex("by_passenger", (q) => q.eq("passengerId", user._id))
        .order("desc")
        .collect();

      // N'afficher que les demandes libres actives (non associées) ou les demandes en attente de conducteur
      const myDemandsRaw = myRequests.filter(
        (r) =>
          r.status !== "cancelled" &&
          r.status !== "rejected" &&
          (!r.tripId || r.status === "pending")
      );

      myDemands = await Promise.all(
        myDemandsRaw.map(async (req) => {
          let trip = null;
          let driver = null;
          if (req.tripId) {
            trip = await ctx.db.get(req.tripId);
            if (trip) {
              const driverDoc = await ctx.db.get(trip.driverId);
              if (driverDoc) {
                driver = {
                  _id: driverDoc._id,
                  name: driverDoc.name,
                  avatarUrl: driverDoc.avatarUrl,
                  status: driverDoc.status,
                };
              }
            }
          }
          return {
            ...req,
            trip,
            driver,
          };
        })
      );
    }

    return {
      myDemands,
      otherDemands,
    };
  },
});

// 9. Traitement du cycle de vie des demandes ouvertes (Cron / périodique)
// - À 30 min de la fin : notification pour garder espoir
// - 30 min après la fin : suppression de la demande et notification d'invalidation
export const processOpenDemandsLifecycleInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    await processOpenDemandsLifecycle(ctx);
    return true;
  },
});

export const processOpenDemandsLifecycleMutation = mutation({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx) => {
    await processOpenDemandsLifecycle(ctx);
    return true;
  },
});
