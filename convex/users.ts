import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUser } from "./auth";

// 1. Obtenir l'utilisateur courant
export const getCurrentUser = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await getAuthenticatedUser(ctx, args.token);
  },
});

// 2. Mettre à jour le Push Token pour les notifications PWA
export const updatePushToken = mutation({
  args: {
    token: v.optional(v.string()),
    pushToken: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) throw new Error("Non authentifié");

    await ctx.db.patch(user._id, {
      pushToken: args.pushToken,
    });
  },
});

// 3. Lister les utilisateurs en attente de validation (MANAGER & ADMIN)
export const listPendingUsers = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user || (user.role !== "manager" && user.role !== "admin")) {
      throw new Error("Accès refusé : rôle Manager ou Admin requis.");
    }

    return await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();
  },
});

// 4. Valider ou refuser un compte (MANAGER & ADMIN)
export const reviewUserStatus = mutation({
  args: {
    token: v.optional(v.string()),
    userId: v.id("users"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const reviewer = await getAuthenticatedUser(ctx, args.token);
    if (!reviewer || (reviewer.role !== "manager" && reviewer.role !== "admin")) {
      throw new Error("Accès refusé : rôle Manager ou Admin requis.");
    }

    await ctx.db.patch(args.userId, {
      status: args.status,
    });

    await ctx.db.insert("notifications", {
      userId: args.userId,
      title: args.status === "approved" ? "Compte validé !" : "Compte non approuvé",
      body:
        args.status === "approved"
          ? "Bienvenue ! Vous pouvez maintenant proposer et réserver des trajets pour l'église."
          : "Votre demande d'inscription n'a pas été retenue.",
      type: "user_approved",
      isRead: false,
      createdAt: Date.now(),
    });
  },
});

// 5. Statistiques globales (ADMIN - PC)
export const getAdminStats = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user || user.role !== "admin") {
      throw new Error("Accès strictement réservé aux Administrateurs.");
    }

    const users = await ctx.db.query("users").collect();
    const trips = await ctx.db.query("trips").collect();
    const requests = await ctx.db.query("requests").collect();

    const pendingUsers = users.filter((u) => u.status === "pending").length;
    const approvedUsers = users.filter((u) => u.status === "approved").length;
    const managers = users.filter((u) => u.role === "manager").length;

    const activeTrips = trips.filter((t) => t.status === "planned" || t.status === "active").length;
    const completedTrips = trips.filter((t) => t.status === "completed").length;
    const acceptedRequests = requests.filter((r) => r.status === "accepted").length;

    return {
      totalUsers: users.length,
      pendingUsers,
      approvedUsers,
      managers,
      activeTrips,
      completedTrips,
      acceptedRequests,
    };
  },
});

// 6. Gestion complète de tous les utilisateurs (MANAGER & ADMIN)
export const listAllUsersAdmin = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      throw new Error("Accès strictement réservé aux Responsables et Administrateurs.");
    }

    return await ctx.db.query("users").order("desc").collect();
  },
});

// 6b. Lister tous les membres (demandes de validation, membres actuels, membres bloqués)
export const listMembersManager = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user || (user.role !== "manager" && user.role !== "admin")) {
      throw new Error("Accès réservé aux Responsables et Administrateurs.");
    }

    return await ctx.db.query("users").order("desc").collect();
  },
});

// 7. Modification du rôle d'un utilisateur (ADMIN - PC)
export const changeUserRole = mutation({
  args: {
    token: v.optional(v.string()),
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("manager"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user || user.role !== "admin") {
      throw new Error("Accès strictement réservé aux Administrateurs.");
    }

    await ctx.db.patch(args.userId, { role: args.role });
  },
});

// 8. Récupérer les notifications de l'utilisateur courant
export const getMyNotifications = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) return [];

    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(30);
  },
});

// 8b. Récupérer le nombre de notifications non lues (optimisé pour badge header)
export const getUnreadNotificationsCount = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) return 0;

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", user._id).eq("isRead", false))
      .collect();

    return unread.length;
  },
});

// 9. Marquer toutes les notifications comme lues
export const markNotificationsAsRead = mutation({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) return;

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", user._id).eq("isRead", false))
      .collect();

    for (const notif of unread) {
      await ctx.db.patch(notif._id, { isRead: true });
    }
  },
});

// 9b. Marquer une seule notification comme lue (lors du clic sur la notification)
export const markSingleNotificationAsRead = mutation({
  args: {
    token: v.optional(v.string()),
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) return;

    const notif = await ctx.db.get(args.notificationId);
    if (notif && notif.userId === user._id && !notif.isRead) {
      await ctx.db.patch(args.notificationId, { isRead: true });
    }
  },
});

// 10. Profil et Statistiques personnelles ("Trajets publiés", "Trajets reçus")
export const getMyProfileStats = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) return null;

    // Trajets publiés en tant que conducteur
    const publishedTrips = await ctx.db
      .query("trips")
      .withIndex("by_driver", (q) => q.eq("driverId", user._id))
      .collect();

    // Trajets reçus / acceptés en tant que passager
    const passengerRequests = await ctx.db
      .query("requests")
      .withIndex("by_passenger", (q) => q.eq("passengerId", user._id))
      .collect();

    const tripsReceivedCount = passengerRequests.filter(
      (r) => r.status === "accepted" || r.status === "pending"
    ).length;

    // Places offertes au total
    const totalSeatsOffered = publishedTrips.reduce((acc, t) => acc + t.totalSeats, 0);

    return {
      user,
      tripsPublishedCount: publishedTrips.length,
      tripsReceivedCount,
      totalSeatsOffered,
      rating: 4.8,
    };
  },
});

// 11. Mettre à jour les informations du profil (tout sauf le mail)
export const updateUserProfile = mutation({
  args: {
    token: v.optional(v.string()),
    name: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
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
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) throw new Error("Authentification requise.");

    const patch: any = {};
    if (args.name !== undefined) {
      const trimmed = args.name.trim();
      if (!trimmed) throw new Error("Le nom ne peut pas être vide.");
      patch.name = trimmed;
    }
    if (args.phoneNumber !== undefined) {
      const trimmedPhone = args.phoneNumber.trim();
      if (!trimmedPhone) throw new Error("Le numéro de téléphone ne peut pas être vide.");
      patch.phoneNumber = trimmedPhone;
    }
    if (args.avatarUrl !== undefined) {
      patch.avatarUrl = args.avatarUrl || undefined;
    }
    if (args.bio !== undefined) {
      patch.bio = args.bio.trim() || undefined;
    }
    if (args.vehicleInfo !== undefined) {
      patch.vehicleInfo = args.vehicleInfo.trim() || undefined;
    }
    if (args.vehiclePhotoUrl !== undefined) {
      patch.vehiclePhotoUrl = args.vehiclePhotoUrl || undefined;
    }
    if (args.city !== undefined) {
      patch.city = args.city.trim() || undefined;
    }
    if (args.homeAddress !== undefined) {
      patch.homeAddress = args.homeAddress;
    }

    // Le mail n'est JAMAIS modifié ici (sécurité stricte)
    await ctx.db.patch(user._id, patch);
    return { success: true };
  },
});

// 12. Mettre à jour les préférences et paramètres de l'utilisateur
export const updateUserPreferences = mutation({
  args: {
    token: v.optional(v.string()),
    preferences: v.object({
      pushNotifications: v.optional(v.boolean()),
      smsNotifications: v.optional(v.boolean()),
      locationSharing: v.optional(v.boolean()),
      departureReminders: v.optional(v.boolean()),
      hidePhoneUntilConfirmed: v.optional(v.boolean()),
      preferredDetourRadius: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user) throw new Error("Authentification requise.");

    const currentPrefs = (user as any).preferences || {};
    await ctx.db.patch(user._id, {
      preferences: {
        ...currentPrefs,
        ...args.preferences,
      },
    });

    return { success: true };
  },
});
