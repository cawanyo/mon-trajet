import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

// Helper Web Crypto SHA-256 pour le hachage sécurisé du mot de passe
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "_mon_trajet_salt_2026");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Générateur de token de session aléatoire et sécurisé
function generateToken(): string {
  return crypto.randomUUID() + "-" + Date.now().toString(36);
}

// Résolution de l'utilisateur authentifié (supporte token de session ou identité OAuth/Convex Auth)
export async function getAuthenticatedUser(
  ctx: QueryCtx | MutationCtx,
  sessionToken?: string
): Promise<Doc<"users"> | null> {
  // 1. Priorité au token de session direct
  if (sessionToken) {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", sessionToken))
      .first();

    if (session && session.expiresAt > Date.now()) {
      const user = await ctx.db.get(session.userId);
      if (user) return user;
    }
  }

  // 2. Repli sur l'identité Auth standard (ex: Clerk / Convex Auth)
  const identity = await ctx.auth.getUserIdentity();
  if (identity) {
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
  }

  return null;
}

// 1. INSCRIPTION
export const register = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phoneNumber: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();
    const cleanPhone = args.phoneNumber.trim();
    const cleanName = args.name.trim();

    if (!cleanName || !cleanEmail || !cleanPhone || !args.password) {
      throw new Error("Tous les champs sont obligatoires.");
    }

    if (cleanName.length < 2) {
      throw new Error("Veuillez renseigner un nom complet valide.");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new Error("Format d'adresse email invalide.");
    }

    if (cleanPhone.length < 6) {
      throw new Error("Veuillez renseigner un numéro de téléphone valide.");
    }

    if (args.password.length < 6) {
      throw new Error("Le mot de passe doit comporter au moins 6 caractères.");
    }

    // Vérifier si l'email existe déjà
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();

    if (existing) {
      throw new Error("Un compte existe déjà avec cette adresse email.");
    }

    const passwordHash = await hashPassword(args.password);

    // Vérifier s'il s'agit du tout premier utilisateur : si oui, lui donner le rôle ADMIN et approuvé
    const allUsers = await ctx.db.query("users").take(1);
    const isFirstUser = allUsers.length === 0;

    const userId = await ctx.db.insert("users", {
      name: cleanName,
      email: cleanEmail,
      phoneNumber: cleanPhone,
      passwordHash,
      role: isFirstUser ? "admin" : "user",
      status: isFirstUser ? "approved" : "pending", // Le premier est admin d'office, les suivants sont "pending"
      createdAt: Date.now(),
    });

    // Créer la session (durée 30 jours)
    const token = generateToken();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

    await ctx.db.insert("sessions", {
      token,
      userId,
      expiresAt,
      createdAt: Date.now(),
    });

    const user = await ctx.db.get(userId);
    return { token, user };
  },
});

// 2. CONNEXION
export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();
    const cleanPassword = args.password;

    if (!cleanEmail || !cleanPassword) {
      throw new Error("Veuillez renseigner votre email et votre mot de passe.");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new Error("Format d'adresse email invalide.");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();

    if (!user || !user.passwordHash) {
      throw new Error("Identifiants incorrects.");
    }

    // Vérifier si le compte a été suspendu ou refusé par un responsable
    if (user.status === "rejected") {
      throw new Error("Votre compte n'a pas été validé par les responsables de l'église.");
    }

    const passwordHash = await hashPassword(cleanPassword);
    if (user.passwordHash !== passwordHash) {
      throw new Error("Identifiants incorrects.");
    }

    // Créer une nouvelle session
    const token = generateToken();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

    await ctx.db.insert("sessions", {
      token,
      userId: user._id,
      expiresAt,
      createdAt: Date.now(),
    });

    return { token, user };
  },
});

// 3. DÉCONNEXION
export const logout = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});

// 4. RÉCUPÉRATION DU PROFIL ACTUEL
export const me = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await getAuthenticatedUser(ctx, args.token);
  },
});
