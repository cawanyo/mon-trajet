import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUser } from "./auth";

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
        return {
          ...trip,
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
    return enrichedTrips.filter(
      (t) => t.availableSeats > 0 && t.departureTime >= now
    );
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

    const requests = await ctx.db
      .query("requests")
      .withIndex("by_trip", (q) => q.eq("tripId", trip._id))
      .collect();

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

    // Filtre strict : Ne mettre dans les trajets que les réservations acceptées par un conducteur
    // Les alertes et demandes non encore acceptées vont dans la page "Demandes"
    const acceptedRequestsOnly = passengerRequests.filter(
      (req) => Boolean(req.tripId) && (req.status === "accepted" || req.status === "cancelled")
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

      for (const req of requests) {
        if (req.status === "accepted") {
          await ctx.db.insert("notifications", {
            userId: req.passengerId,
            title: "Trajet annulé",
            body: `Le conducteur a annulé le trajet prévu.`,
            type: "trip_cancelled",
            relatedTripId: trip._id,
            isRead: false,
            createdAt: Date.now(),
          });
        }
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

    if (trip.departureTime < Date.now()) {
      throw new Error("Impossible de modifier un trajet dont l'heure est déjà passée.");
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

      const acceptedSeats = requests
        .filter((r) => r.status === "accepted")
        .reduce((sum, r) => sum + r.seatsRequested, 0);

      if (args.totalSeats < acceptedSeats) {
        throw new Error(
          `Impossible de réduire à ${args.totalSeats} places : ${acceptedSeats} place(s) sont déjà occupées.`
        );
      }

      updates.totalSeats = args.totalSeats;
      updates.availableSeats = args.totalSeats - acceptedSeats;
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

    // Seuil de recherche : inclut les trajets récents (jusqu'à 1h en arrière) s'ils sont encore planifiés ou en cours
    const threshold = Date.now() - 60 * 60 * 1000;

    // Trajets en tant que conducteur
    const driverTrips = await ctx.db
      .query("trips")
      .withIndex("by_driver", (q) => q.eq("driverId", currentUser._id))
      .filter((q) =>
        q.and(
          q.or(q.eq(q.field("status"), "planned"), q.eq(q.field("status"), "active")),
          q.gte(q.field("departureTime"), threshold)
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
          (trip.status === "planned" || trip.status === "active") &&
          trip.departureTime >= threshold
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

          upcomingPassengerTrips.push({
            _id: trip._id,
            role: "passenger" as const,
            status: trip.status,
            title: trip.destinationLocation?.address?.includes("Église")
              ? "Trajet vers l'église"
              : `Trajet vers ${trip.destinationLocation?.address || "l'église"}`,
            departureTime: trip.departureTime,
            availableSeats: trip.availableSeats,
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
      driverTrips.map(async (t) => {
        // Récupération de tous les passagers acceptés pour ce trajet (points d'escale)
        const acceptedRequests = await ctx.db
          .query("requests")
          .withIndex("by_trip", (q) => q.eq("tripId", t._id))
          .filter((q) => q.eq(q.field("status"), "accepted"))
          .collect();

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
          availableSeats: t.availableSeats,
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
