import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Table des utilisateurs avec rôles stricts et statut d'approbation
  users: defineTable({
    name: v.string(),
    email: v.string(),
    phoneNumber: v.string(), // Obligatoire: Masqué par défaut sauf après validation d'un trajet
    passwordHash: v.optional(v.string()), // Hachage SHA-256 pour l'authentification native
    role: v.union(v.literal("user"), v.literal("manager"), v.literal("admin")),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    vehicleInfo: v.optional(v.string()),
    vehiclePhotoUrl: v.optional(v.string()),
    city: v.optional(v.string()),
    homeAddress: v.optional(
      v.object({
        address: v.string(),
        lat: v.optional(v.number()),
        lng: v.optional(v.number()),
      })
    ),
    preferences: v.optional(
      v.object({
        pushNotifications: v.optional(v.boolean()),
        smsNotifications: v.optional(v.boolean()),
        locationSharing: v.optional(v.boolean()),
        departureReminders: v.optional(v.boolean()),
        hidePhoneUntilConfirmed: v.optional(v.boolean()),
        preferredDetourRadius: v.optional(v.number()),
      })
    ),
    pushToken: v.optional(v.string()), // Token Web Push / PWA
    tokenIdentifier: v.optional(v.string()), // Identifiant Auth externe (optionnel si Clerk/OAuth)
    createdAt: v.number(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .index("by_role", ["role"])
    .index("by_status", ["status"]),

  // Sessions d'authentification directes
  sessions: defineTable({
    token: v.string(),
    userId: v.id("users"),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  // Trajets proposés par les conducteurs
  trips: defineTable({
    driverId: v.id("users"),
    departureLocation: v.object({
      lat: v.number(),
      lng: v.number(),
      address: v.string(),
    }),
    destinationLocation: v.object({
      lat: v.number(),
      lng: v.number(),
      address: v.string(), // Par défaut l'église
    }),
    departureTime: v.number(), // Timestamp Unix (ms)
    totalSeats: v.number(),
    availableSeats: v.number(),
    pickupRadiusMeters: v.optional(v.number()), // Périmètre toléré pour récupérer un passager (200m - 5000m)
    status: v.union(
      v.literal("planned"),     // Planifié et ouvert
      v.literal("active"),      // En cours de route
      v.literal("completed"),   // Terminé
      v.literal("cancelled")    // Annulé
    ),
    currentLocation: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
        updatedAt: v.optional(v.number()),
      })
    ),
    nextDestinationName: v.optional(v.string()),
    currentEscaleIndex: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_driver", ["driverId"])
    .index("by_status", ["status"])
    .index("by_departure_time", ["departureTime"]),

  // Demandes de places ou signaux de besoin de covoiturage
  requests: defineTable({
    passengerId: v.id("users"),
    tripId: v.optional(v.id("trips")), // Optionnel: Si non renseigné, c'est un "Signal de besoin" généraliste
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
    status: v.union(
      v.literal("pending"),    // En attente d'acceptation
      v.literal("accepted"),   // Accepté par le conducteur (débloque le n° de téléphone)
      v.literal("rejected"),   // Refusé
      v.literal("cancelled")   // Annulé par le passager
    ),
    seatsRequested: v.number(),
    desiredDate: v.optional(v.string()), // Date cible "YYYY-MM-DD" pour laquelle le trajet est demandé
    desiredTimeSlot: v.optional(v.string()), // Créneau souhaité ex: "08h - 10h"
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_passenger", ["passengerId"])
    .index("by_trip", ["tripId"])
    .index("by_status", ["status"]),

  // Notifications temps réel in-app / push
  notifications: defineTable({
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    type: v.union(
      v.literal("request_received"),
      v.literal("request_accepted"),
      v.literal("request_rejected"),
      v.literal("user_approved"),
      v.literal("trip_cancelled"),
      v.literal("trip_started"),
      v.literal("trip_reminder_45"),
      v.literal("trip_reminder_5")
    ),
    relatedTripId: v.optional(v.id("trips")),
    relatedRequestId: v.optional(v.id("requests")),
    link: v.optional(v.string()),
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "isRead"])
    .index("by_user_trip", ["userId", "relatedTripId"]),

  // Paramètres de l'église (configurés par le Manager ou l'Admin)
  churchSettings: defineTable({
    name: v.string(),
    address: v.string(),
    lat: v.number(),
    lng: v.number(),
    updatedAt: v.number(),
  }),
});
