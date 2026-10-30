import { v } from "convex/values";
import { mutation, query, internalMutation, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getAuthenticatedUser } from "./auth";

/**
 * Recalcule et synchronise le nombre de places disponibles sur un trajet :
 * - Les places sont réservées dès qu'une demande est soumise (statut 'pending' ou 'accepted').
 * - Si le conducteur refuse la demande ('rejected') ou si le passager l'annule ('cancelled'),
 *   la place est immédiatement libérée.
 */
export async function syncTripAvailableSeats(ctx: any, tripId: Id<"trips">): Promise<number> {
  const trip = await ctx.db.get(tripId);
  if (!trip) return 0;

  const requests = await ctx.db
    .query("requests")
    .withIndex("by_trip", (q: any) => q.eq("tripId", tripId))
    .collect();

  const reservedSeats = requests
    .filter((r: any) => r.status === "accepted" || r.status === "pending")
    .reduce((sum: number, r: any) => sum + (r.seatsRequested || 1), 0);

  const newAvailableSeats = Math.max(0, trip.totalSeats - reservedSeats);

  if (trip.availableSeats !== newAvailableSeats) {
    await ctx.db.patch(tripId, { availableSeats: newAvailableSeats });
  }

  return newAvailableSeats;
}

// 1. Proposer un trajet (Conducteur)
export const createTrip = mutation({
  args: {
    token: v.optional(v.string()),
    departureLocation: v.object({
      lat: v.number(),
      lng: v.number(),
      address: v.string(),
    }),
    destinationLocation: v.object({
      lat: v.number(),
      lng: v.number(),
      address: v.string(),
    }),
    departureTime: v.number(),
    totalSeats: v.number(),
    pickupRadiusMeters: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) throw new Error("Authentification requise.");
    if (user.status === "rejected") {
      throw new Error("Votre compte n'est pas autorisé à proposer un trajet.");
    }

    if (args.totalSeats <= 0) {
      throw new Error("Le nombre de places doit être supérieur à 0.");
    }

    const tripId = await ctx.db.insert("trips", {
      driverId: user._id,
      departureLocation: args.departureLocation,
      destinationLocation: args.destinationLocation,
      departureTime: args.departureTime,
      totalSeats: args.totalSeats,
      availableSeats: args.totalSeats,
      pickupRadiusMeters: args.pickupRadiusMeters ?? 500,
      status: "planned",
      notes: args.notes,
      createdAt: Date.now(),
    });

    return tripId;
  },
});

// 2. Lister les trajets disponibles pour la carte en temps réel
// PRIVACY: Le numéro de téléphone du conducteur N'EST PAS divulgué ici
export const listAvailableTrips = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx) => {
    const plannedTrips = await ctx.db
      .query("trips")
      .withIndex("by_status", (q) => q.eq("status", "planned"))
      .collect();
    const activeTrips = await ctx.db
      .query("trips")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const trips = [...plannedTrips, ...activeTrips];

    const enrichedTrips = await Promise.all(
      trips.map(async (trip) => {
        const driver = await ctx.db.get(trip.driverId);
        const requests = await ctx.db
          .query("requests")
          .withIndex("by_trip", (q) => q.eq("tripId", trip._id))
          .collect();

        const reservedSeats = requests
          .filter((r) => r.status === "accepted" || r.status === "pending")
          .reduce((sum, r) => sum + (r.seatsRequested || 1), 0);
        const availableSeats = Math.max(0, trip.totalSeats - reservedSeats);

        return {
          ...trip,
          availableSeats,
          driver: driver
            ? {
                _id: driver._id,
                name: driver.name,
                avatarUrl: driver.avatarUrl,
                status: driver.status, // Statut de validation pour le ticker
                // Numéro masqué sur la carte publique !
              }
            : null,
        };
      })
    );

    const now = Date.now();
    return enrichedTrips.filter((t) => {
      if (t.availableSeats <= 0) return false;
      if (t.status === "completed" || t.status === "cancelled") return false;
      // Considéré comme annulé si le conducteur ne l'a pas démarré 45 minutes après l'heure prévue
      if (t.status === "planned" && now > t.departureTime + 45 * 60 * 1000) return false;
      return true;
    });
  },
});

// 3. Obtenir les détails d'un trajet avec contrôle strict du téléphone
export const getTripDetails = query({
  args: {
    token: v.optional(v.string()),
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getAuthenticatedUser(ctx, args.token);
    const trip = await ctx.db.get(args.tripId);
    if (!trip) return null;

    const driver = await ctx.db.get(trip.driverId);
    if (!driver) return null;

    const rawRequests = await ctx.db
      .query("requests")
      .withIndex("by_trip", (q) => q.eq("tripId", trip._id))
      .collect();

    const requests = rawRequests.filter((r) => r.status !== "cancelled");

    const reservedSeats = requests
      .filter((r) => r.status === "accepted" || r.status === "pending")
      .reduce((sum, r) => sum + (r.seatsRequested || 1), 0);
    const availableSeats = Math.max(0, trip.totalSeats - reservedSeats);

    const isDriver = currentUser && currentUser._id === trip.driverId;
    const isAcceptedPassenger =
      currentUser &&
      requests.some(
        (r) => r.passengerId === currentUser._id && r.status === "accepted"
      );

    const enrichedRequests = await Promise.all(
      requests.map(async (req) => {
        const passenger = await ctx.db.get(req.passengerId);
        // Le conducteur ne voit le téléphone du passager QUE s'il est accepté
        const canViewPassengerPhone =
          isDriver && req.status === "accepted" && passenger;

        return {
          ...req,
          passenger: passenger
            ? {
                _id: passenger._id,
                name: passenger.name,
                avatarUrl: passenger.avatarUrl,
                status: passenger.status,
                phoneNumber: canViewPassengerPhone ? passenger.phoneNumber : null,
                createdAt: passenger.createdAt,
              }
            : null,
        };
      })
    );

    // Le passager ne voit le numéro du conducteur QUE si sa demande est acceptée
    const canViewDriverPhone = isDriver || isAcceptedPassenger;

    return {
      ...trip,
      availableSeats,
      driver: {
        _id: driver._id,
        name: driver.name,
        avatarUrl: driver.avatarUrl,
        status: driver.status,
        phoneNumber: canViewDriverPhone ? driver.phoneNumber : null,
      },
      requests: enrichedRequests,
      userRelationship: {
        isDriver: !!isDriver,
        hasPendingRequest: requests.some(
          (r) => currentUser && r.passengerId === currentUser._id && r.status === "pending"
        ),
        hasAcceptedRequest: !!isAcceptedPassenger,
      },
    };
  },
});

// 4. "Mes Trajets" : Trajets où je suis conducteur OU passager
export const listMyTrips = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getAuthenticatedUser(ctx, args.token);
    if (!currentUser) return { asDriver: [], asPassenger: [] };

    // Trajets en tant que conducteur
    const driverTrips = await ctx.db
      .query("trips")
      .withIndex("by_driver", (q) => q.eq("driverId", currentUser._id))
      .order("desc")
      .collect();

    const enrichedDriverTrips = await Promise.all(
      driverTrips.map(async (trip) => {
        const requests = await ctx.db
          .query("requests")
          .withIndex("by_trip", (q) => q.eq("tripId", trip._id))
          .collect();

        const reservedSeats = requests
          .filter((r) => r.status === "accepted" || r.status === "pending")
          .reduce((sum, r) => sum + (r.seatsRequested || 1), 0);
        const availableSeats = Math.max(0, trip.totalSeats - reservedSeats);

        const enrichedRequests = await Promise.all(
          requests.map(async (req) => {
            const passenger = await ctx.db.get(req.passengerId);
            return {
              ...req,
              passenger: passenger
                ? {
                    _id: passenger._id,
                    name: passenger.name,
                    status: passenger.status,
                    phoneNumber: req.status === "accepted" ? passenger.phoneNumber : null,
                  }
                : null,
            };
          })
        );

        return {
          ...trip,
          availableSeats,
          requests: enrichedRequests,
        };
      })
    );

    // Trajets en tant que passager : Uniquement les trajets acceptés par un conducteur
    const passengerRequests = await ctx.db
      .query("requests")
      .withIndex("by_passenger", (q) => q.eq("passengerId", currentUser._id))
      .order("desc")
      .collect();

    // Filtre strict : Ne mettre dans les trajets que les réservations actives acceptées par un conducteur
    const acceptedRequestsOnly = passengerRequests.filter(
      (req) => Boolean(req.tripId) && req.status === "accepted"
    );

    const enrichedPassengerTrips = await Promise.all(
      acceptedRequestsOnly.map(async (req) => {
        const trip = req.tripId ? await ctx.db.get(req.tripId) : null;
        let driver = null;
        if (trip) {
          const driverDoc = await ctx.db.get(trip.driverId);
          if (driverDoc) {
            driver = {
              _id: driverDoc._id,
              name: driverDoc.name,
              status: driverDoc.status,
              phoneNumber: req.status === "accepted" ? driverDoc.phoneNumber : null,
            };
          }
        }
        return {
          request: req,
          trip,
          driver,
        };
      })
    );

    return {
      asDriver: enrichedDriverTrips,
      asPassenger: enrichedPassengerTrips,
    };
  },
});

// 5. Modifier le statut d'un trajet (terminé / annulé)
export const updateTripStatus = mutation({
  args: {
    token: v.optional(v.string()),
    tripId: v.id("trips"),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("cancelled")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) throw new Error("Authentification requise.");

    const trip = await ctx.db.get(args.tripId);
    if (!trip) throw new Error("Trajet introuvable.");

    if (trip.driverId !== user._id && user.role !== "admin") {
      throw new Error("Seul le conducteur ou un administrateur peut modifier ce trajet.");
    }

    await ctx.db.patch(args.tripId, { status: args.status });

    if (args.status === "cancelled") {
      const requests = await ctx.db
        .query("requests")
        .withIndex("by_trip", (q) => q.eq("tripId", trip._id))
        .collect();

      const pushTokens: string[] = [];
      for (const req of requests) {
        if (req.status === "accepted") {
          await ctx.db.insert("notifications", {
            userId: req.passengerId,
            title: "Trajet annulé",
            body: `Le conducteur ${user.name} a annulé le trajet prévu.`,
            type: "trip_cancelled",
            relatedTripId: trip._id,
            isRead: false,
            createdAt: Date.now(),
          });

          const passenger = await ctx.db.get(req.passengerId);
          if (passenger?.pushToken) {
            pushTokens.push(passenger.pushToken);
          }
        }
      }

      if (pushTokens.length > 0) {
        await ctx.scheduler.runAfter(0, internal.push.dispatchPushNotifications, {
          pushTokens,
          title: "Trajet annulé ❌",
          body: `Le conducteur ${user.name} a annulé le trajet prévu.`,
          url: "/trips",
        });
      }
    }
  },
});

// 5b. Modifier les paramètres d'un trajet (places, heure, périmètre, notes)
export const updateTrip = mutation({
  args: {
    token: v.optional(v.string()),
    tripId: v.id("trips"),
    departureTime: v.optional(v.number()),
    totalSeats: v.optional(v.number()),
    pickupRadiusMeters: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) throw new Error("Authentification requise.");

    const trip = await ctx.db.get(args.tripId);
    if (!trip) throw new Error("Trajet introuvable.");

    if (trip.driverId !== user._id && user.role !== "admin") {
      throw new Error("Seul le conducteur ou un administrateur peut modifier ce trajet.");
    }

    if (trip.status === "completed") {
      throw new Error("Impossible de modifier un trajet déjà terminé.");
    }
    if (trip.status === "cancelled") {
      throw new Error("Impossible de modifier un trajet annulé.");
    }
    if (trip.status === "planned" && Date.now() > trip.departureTime + 45 * 60 * 1000) {
      throw new Error("Ce trajet n'a pas été démarré dans les 45 minutes et est considéré comme annulé.");
    }

    const updates: Record<string, any> = {};
    if (args.departureTime !== undefined) updates.departureTime = args.departureTime;
    if (args.pickupRadiusMeters !== undefined) updates.pickupRadiusMeters = args.pickupRadiusMeters;
    if (args.notes !== undefined) updates.notes = args.notes;

    if (args.totalSeats !== undefined) {
      if (args.totalSeats <= 0) {
        throw new Error("Le nombre de places doit être supérieur à 0.");
      }

      const requests = await ctx.db
        .query("requests")
        .withIndex("by_trip", (q) => q.eq("tripId", trip._id))
        .collect();

      const reservedSeats = requests
        .filter((r) => r.status === "accepted" || r.status === "pending")
        .reduce((sum, r) => sum + (r.seatsRequested || 1), 0);

      if (args.totalSeats < reservedSeats) {
        throw new Error(
          `Impossible de réduire à ${args.totalSeats} places : ${reservedSeats} place(s) sont déjà occupées ou demandées.`
        );
      }

      updates.totalSeats = args.totalSeats;
      updates.availableSeats = Math.max(0, args.totalSeats - reservedSeats);
    }

    await ctx.db.patch(args.tripId, updates);
    return true;
  },
});

// 5bis. Lancement du trajet par le conducteur ("Y aller")
export const startTrip = mutation({
  args: {
    token: v.optional(v.string()),
    tripId: v.id("trips"),
    currentLocation: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
      })
    ),
    nextDestinationName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) throw new Error("Non autorisé.");

    const trip = await ctx.db.get(args.tripId);
    if (!trip) throw new Error("Trajet introuvable.");
    if (trip.driverId !== user._id) {
      throw new Error("Vous n'êtes pas le conducteur de ce trajet.");
    }

    if (trip.status === "completed") {
      throw new Error("Ce trajet est déjà terminé.");
    }
    if (trip.status === "cancelled") {
      throw new Error("Ce trajet a été annulé.");
    }
    if (trip.status === "planned" && Date.now() > trip.departureTime + 45 * 60 * 1000) {
      await ctx.db.patch(args.tripId, { status: "cancelled" });
      throw new Error("Le trajet n'a pas été démarré dans les 45 minutes et a été considéré comme annulé.");
    }

    const updates: Record<string, any> = {
      status: "active",
      startedAt: Date.now(),
    };

    if (args.currentLocation) {
      updates.currentLocation = {
        lat: args.currentLocation.lat,
        lng: args.currentLocation.lng,
        updatedAt: Date.now(),
      };
    }

    if (args.nextDestinationName) {
      updates.nextDestinationName = args.nextDestinationName;
    }

    await ctx.db.patch(args.tripId, updates);

    // Notifier tous les passagers confirmés que le conducteur commence le trajet
    const tripRequests = await ctx.db
      .query("requests")
      .withIndex("by_trip", (q) => q.eq("tripId", trip._id))
      .collect();

    const pushTokens: string[] = [];

    for (const req of tripRequests) {
      if (req.status === "accepted") {
        await ctx.db.insert("notifications", {
          userId: req.passengerId,
          title: "Votre conducteur est en route ! 🚗",
          body: `${user.name} a démarré le trajet. Préparez-vous à votre point de prise en charge.`,
          type: "trip_started",
          relatedTripId: trip._id,
          link: `/trips/${trip._id}`,
          isRead: false,
          createdAt: Date.now(),
        });

        const passenger = await ctx.db.get(req.passengerId);
        if (passenger?.pushToken) {
          pushTokens.push(passenger.pushToken);
        }
      }
    }

    // Réveil des téléphones via Web Push même si l'application est fermée
    if (pushTokens.length > 0) {
      await ctx.scheduler.runAfter(0, internal.push.dispatchPushNotifications, {
        pushTokens,
        title: "Votre conducteur est en route ! 🚗",
        body: `${user.name} a démarré le trajet. Préparez-vous à votre point de prise en charge.`,
        url: `/trips/${trip._id}`,
      });
    }

    return true;
  },
});

// 5ter. Mise à jour de la position en direct du conducteur
export const updateDriverLocation = mutation({
  args: {
    token: v.optional(v.string()),
    tripId: v.id("trips"),
    location: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    nextDestinationName: v.optional(v.string()),
    currentEscaleIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) throw new Error("Non autorisé.");

    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.driverId !== user._id) {
      throw new Error("Non autorisé.");
    }

    const updates: Record<string, any> = {
      currentLocation: {
        lat: args.location.lat,
        lng: args.location.lng,
        updatedAt: Date.now(),
      },
    };

    if (args.nextDestinationName !== undefined) {
      updates.nextDestinationName = args.nextDestinationName;
    }
    if (args.currentEscaleIndex !== undefined) {
      updates.currentEscaleIndex = args.currentEscaleIndex;
    }

    await ctx.db.patch(args.tripId, updates);
    return true;
  },
});

// 5quater. Passage à l'escale suivante par le conducteur
export const advanceTripEscale = mutation({
  args: {
    token: v.optional(v.string()),
    tripId: v.id("trips"),
    nextIndex: v.number(),
    nextDestinationName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) throw new Error("Non autorisé.");

    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.driverId !== user._id) {
      throw new Error("Non autorisé.");
    }

    await ctx.db.patch(args.tripId, {
      currentEscaleIndex: args.nextIndex,
      ...(args.nextDestinationName ? { nextDestinationName: args.nextDestinationName } : {}),
    });
    return true;
  },
});

// 5quinquies. Clôture du trajet à l'arrivée à destination
export const completeTrip = mutation({
  args: {
    token: v.optional(v.string()),
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) throw new Error("Non autorisé.");

    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.driverId !== user._id) {
      throw new Error("Non autorisé.");
    }

    await ctx.db.patch(args.tripId, {
      status: "completed",
    });
    return true;
  },
});

// 6. Prochain trajet de l'utilisateur (conducteur ou passager accepté)
export const getNextUpcomingTrip = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const currentUser = await getAuthenticatedUser(ctx, args.token);
    if (!currentUser) return null;

    const now = Date.now();
    // Seuil de recherche : inclut les trajets récents (jusqu'à 45 min après l'heure prévue pour les trajets non encore démarrés)
    const threshold = now - 45 * 60 * 1000;

    // Trajets en tant que conducteur
    const driverTrips = await ctx.db
      .query("trips")
      .withIndex("by_driver", (q) => q.eq("driverId", currentUser._id))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.and(
            q.eq(q.field("status"), "planned"),
            q.gte(q.field("departureTime"), threshold)
          )
        )
      )
      .collect();

    // Trajets en tant que passager accepté
    const passengerRequests = await ctx.db
      .query("requests")
      .withIndex("by_passenger", (q) => q.eq("passengerId", currentUser._id))
      .filter((q) => q.eq(q.field("status"), "accepted"))
      .collect();

    const upcomingPassengerTrips = [];
    for (const req of passengerRequests) {
      if (req.tripId) {
        const trip = await ctx.db.get(req.tripId);
        if (
          trip &&
          (trip.status === "active" ||
            (trip.status === "planned" && now <= trip.departureTime + 45 * 60 * 1000))
        ) {
          const driver = await ctx.db.get(trip.driverId);

          // Escales du trajet pour connaître l'enchaînement et la prochaine destination
          const acceptedRequests = await ctx.db
            .query("requests")
            .withIndex("by_trip", (q) => q.eq("tripId", trip._id))
            .filter((q) => q.eq(q.field("status"), "accepted"))
            .collect();

          const escales = await Promise.all(
            acceptedRequests.map(async (r) => {
              const p = await ctx.db.get(r.passengerId);
              return {
                requestId: r._id,
                passengerId: r.passengerId,
                passengerName: p?.name ?? "Passager",
                passengerAvatar: p?.avatarUrl,
                passengerStatus: p?.status,
                passengerPhone: p?.phoneNumber,
                pickupLocation: r.pickupLocation,
                seatsRequested: r.seatsRequested,
                note: r.note,
              };
            })
          );

          const allTripRequests = await ctx.db
            .query("requests")
            .withIndex("by_trip", (q) => q.eq("tripId", trip._id))
            .collect();
          const tripReservedSeats = allTripRequests
            .filter((r) => r.status === "accepted" || r.status === "pending")
            .reduce((sum, r) => sum + (r.seatsRequested || 1), 0);
          const dynamicTripAvailableSeats = Math.max(0, trip.totalSeats - tripReservedSeats);

          upcomingPassengerTrips.push({
            _id: trip._id,
            role: "passenger" as const,
            status: trip.status,
            title: trip.destinationLocation?.address?.includes("Église")
              ? "Trajet vers l'église"
              : `Trajet vers ${trip.destinationLocation?.address || "l'église"}`,
            departureTime: trip.departureTime,
            availableSeats: dynamicTripAvailableSeats,
            totalSeats: trip.totalSeats,
            seatsRequested: req.seatsRequested,
            driverId: trip.driverId,
            driverName: driver?.name ?? "Conducteur",
            driverStatus: driver?.status,
            driverPhone: driver?.phoneNumber,
            driverAvatar: driver?.avatarUrl,
            departureLocation: trip.departureLocation,
            destinationLocation: trip.destinationLocation,
            departureAddress: trip.departureLocation.address,
            destinationAddress: trip.destinationLocation.address,
            myPickupLocation: req.pickupLocation,
            currentLocation: trip.currentLocation,
            nextDestinationName: trip.nextDestinationName,
            currentEscaleIndex: trip.currentEscaleIndex,
            startedAt: trip.startedAt,
            escales,
          });
        }
      }
    }

    const upcomingDriverTrips = await Promise.all(
      driverTrips
        .filter((t) => !(t.status === "planned" && now > t.departureTime + 45 * 60 * 1000))
        .map(async (t) => {
        // Récupération de tous les passagers acceptés pour ce trajet (points d'escale)
        const allTripRequests = await ctx.db
          .query("requests")
          .withIndex("by_trip", (q) => q.eq("tripId", t._id))
          .collect();

        const acceptedRequests = allTripRequests.filter((q) => q.status === "accepted");
        const tripReservedSeats = allTripRequests
          .filter((r) => r.status === "accepted" || r.status === "pending")
          .reduce((sum, r) => sum + (r.seatsRequested || 1), 0);
        const dynamicTripAvailableSeats = Math.max(0, t.totalSeats - tripReservedSeats);

        const escales = await Promise.all(
          acceptedRequests.map(async (req) => {
            const passenger = await ctx.db.get(req.passengerId);
            return {
              requestId: req._id,
              passengerId: req.passengerId,
              passengerName: passenger?.name ?? "Passager",
              passengerAvatar: passenger?.avatarUrl,
              passengerStatus: passenger?.status,
              passengerPhone: passenger?.phoneNumber,
              pickupLocation: req.pickupLocation,
              seatsRequested: req.seatsRequested,
              note: req.note,
            };
          })
        );

        return {
          _id: t._id,
          role: "driver" as const,
          status: t.status,
          title: t.destinationLocation?.address?.includes("Église")
            ? "Trajet vers l'église"
            : `Trajet vers ${t.destinationLocation?.address || "l'église"}`,
          departureTime: t.departureTime,
          availableSeats: dynamicTripAvailableSeats,
          totalSeats: t.totalSeats,
          seatsRequested: undefined,
          driverName: currentUser.name,
          driverStatus: currentUser.status,
          departureLocation: t.departureLocation,
          destinationLocation: t.destinationLocation,
          departureAddress: t.departureLocation.address,
          destinationAddress: t.destinationLocation.address,
          currentLocation: t.currentLocation,
          nextDestinationName: t.nextDestinationName,
          currentEscaleIndex: t.currentEscaleIndex,
          startedAt: t.startedAt,
          escales,
        };
      })
    );

    const allUpcoming = [...upcomingDriverTrips, ...upcomingPassengerTrips].sort(
      (a, b) => a.departureTime - b.departureTime
    );

    return allUpcoming[0] ?? null;
  },
});

// Traitement des rappels automatiques (45 min et 5 min)
async function processTripReminders(ctx: MutationCtx) {
  const now = Date.now();
  const plannedTrips = await ctx.db
    .query("trips")
    .withIndex("by_status", (q) => q.eq("status", "planned"))
    .collect();

  for (const trip of plannedTrips) {
    // Si non démarré après 45 minutes, annulation automatique
    if (now > trip.departureTime + 45 * 60 * 1000) {
      await ctx.db.patch(trip._id, { status: "cancelled" });
      continue;
    }

    const diffMs = trip.departureTime - now;

    // Récupérer le nom du conducteur et l'adresse de destination
    const driver = await ctx.db.get(trip.driverId);
    const driverName = driver?.name || "Votre conducteur";
    const dest = trip.destinationLocation.address || "l'église";

    const rawRequests = await ctx.db
      .query("requests")
      .withIndex("by_trip", (q) => q.eq("tripId", trip._id))
      .collect();

    const requests = rawRequests.filter((r) => r.status !== "cancelled");
    const acceptedRequests = requests.filter((r) => r.status === "accepted");

    // 1. Rappel à 45 minutes du trajet
    if (diffMs <= 45 * 60 * 1000 && diffMs > 5 * 60 * 1000) {
      const pushTokens45: string[] = [];

      // Pour le conducteur
      const existingDriver45 = await ctx.db
        .query("notifications")
        .withIndex("by_user_trip", (q) =>
          q.eq("userId", trip.driverId).eq("relatedTripId", trip._id)
        )
        .filter((q) => q.eq(q.field("type"), "trip_reminder_45"))
        .first();

      if (!existingDriver45) {
        await ctx.db.insert("notifications", {
          userId: trip.driverId,
          title: "Rappel trajet : Départ dans 45 min",
          body: `Votre trajet vers ${dest} est prévu dans 45 minutes.`,
          type: "trip_reminder_45",
          relatedTripId: trip._id,
          link: `/trips/${trip._id}`,
          isRead: false,
          createdAt: now,
        });

        if (driver?.pushToken) {
          pushTokens45.push(driver.pushToken);
        }
      }

      // Pour les passagers acceptés
      for (const req of acceptedRequests) {
        const existingPassenger45 = await ctx.db
          .query("notifications")
          .withIndex("by_user_trip", (q) =>
            q.eq("userId", req.passengerId).eq("relatedTripId", trip._id)
          )
          .filter((q) => q.eq(q.field("type"), "trip_reminder_45"))
          .first();

        if (!existingPassenger45) {
          await ctx.db.insert("notifications", {
            userId: req.passengerId,
            title: "Rappel trajet : Départ dans 45 min",
            body: `Votre trajet avec ${driverName} vers ${dest} est prévu dans 45 minutes.`,
            type: "trip_reminder_45",
            relatedTripId: trip._id,
            link: `/trips/${trip._id}`,
            isRead: false,
            createdAt: now,
          });

          const pass = await ctx.db.get(req.passengerId);
          if (pass?.pushToken) {
            pushTokens45.push(pass.pushToken);
          }
        }
      }

      if (pushTokens45.length > 0) {
        await ctx.scheduler.runAfter(0, internal.push.dispatchPushNotifications, {
          pushTokens: pushTokens45,
          title: "Rappel trajet : Départ dans 45 min",
          body: `Votre trajet vers ${dest} est prévu dans 45 minutes.`,
          url: `/trips/${trip._id}`,
        });
      }
    }

    // 2. Rappel à 5 minutes du trajet (ouvre la page d'accueil)
    if (diffMs <= 5 * 60 * 1000 && diffMs >= -15 * 60 * 1000) {
      const pushTokens5: string[] = [];

      // Pour le conducteur
      const existingDriver5 = await ctx.db
        .query("notifications")
        .withIndex("by_user_trip", (q) =>
          q.eq("userId", trip.driverId).eq("relatedTripId", trip._id)
        )
        .filter((q) => q.eq(q.field("type"), "trip_reminder_5"))
        .first();

      if (!existingDriver5) {
        await ctx.db.insert("notifications", {
          userId: trip.driverId,
          title: "Départ imminent dans 5 minutes ! 🚗",
          body: `Votre trajet vers ${dest} commence dans 5 minutes. Rendez-vous sur la carte d'accueil.`,
          type: "trip_reminder_5",
          relatedTripId: trip._id,
          link: "/",
          isRead: false,
          createdAt: now,
        });

        if (driver?.pushToken) {
          pushTokens5.push(driver.pushToken);
        }
      }

      // Pour les passagers acceptés
      for (const req of acceptedRequests) {
        const existingPassenger5 = await ctx.db
          .query("notifications")
          .withIndex("by_user_trip", (q) =>
            q.eq("userId", req.passengerId).eq("relatedTripId", trip._id)
          )
          .filter((q) => q.eq(q.field("type"), "trip_reminder_5"))
          .first();

        if (!existingPassenger5) {
          await ctx.db.insert("notifications", {
            userId: req.passengerId,
            title: "Départ imminent dans 5 minutes ! 🚗",
            body: `Votre trajet avec ${driverName} débute dans 5 minutes. Rejoignez votre point de rendez-vous.`,
            type: "trip_reminder_5",
            relatedTripId: trip._id,
            link: "/",
            isRead: false,
            createdAt: now,
          });

          const pass = await ctx.db.get(req.passengerId);
          if (pass?.pushToken) {
            pushTokens5.push(pass.pushToken);
          }
        }
      }

      if (pushTokens5.length > 0) {
        await ctx.scheduler.runAfter(0, internal.push.dispatchPushNotifications, {
          pushTokens: pushTokens5,
          title: "Départ imminent dans 5 minutes ! 🚗",
          body: `Votre trajet vers ${dest} débute dans 5 minutes.`,
          url: "/",
        });
      }
    }
  }
}

// 13. Mutation interne déclenchée par le Cron Convex chaque minute
export const checkAndSendTripRemindersInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    await processTripReminders(ctx);
    return true;
  },
});

// 14. Mutation publique pour tick périodique côté client
export const checkAndSendTripReminders = mutation({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx) => {
    await processTripReminders(ctx);
    return true;
  },
});
