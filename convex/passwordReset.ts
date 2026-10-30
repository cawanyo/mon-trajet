import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { hashPassword, generateToken } from "./auth";

/**
 * 1. Génération d'un jeton et code de réinitialisation (15 minutes de validité)
 * Appelé depuis la route API Next.js /api/auth/forgot-password
 */
export const requestResetToken = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();

    // 1. Recherche de l'utilisateur
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();

    if (!user) {
      // Pour éviter l'énumération des emails, on renvoie succès sans renvoyer de données sensibles
      return { success: true, exists: false };
    }

    // 2. Invalider les anciens tokens non utilisés pour cet email
    const existingTokens = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .collect();

    for (const oldToken of existingTokens) {
      if (!oldToken.used) {
        await ctx.db.patch(oldToken._id, { used: true });
      }
    }

    // 3. Créer un nouveau jeton cryptographique et un code à 6 chiffres
    const token = crypto.randomUUID().replace(/-/g, "") + Date.now().toString(36);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    await ctx.db.insert("passwordResetTokens", {
      email: cleanEmail,
      token,
      code,
      expiresAt,
      used: false,
      createdAt: Date.now(),
    });

    return {
      success: true,
      exists: true,
      token,
      code,
      userName: user.name,
      email: user.email,
    };
  },
});

/**
 * 2. Vérification de la validité d'un jeton ou code avant affichage du formulaire
 */
export const verifyResetToken = query({
  args: {
    token: v.optional(v.string()),
    code: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.token) {
      const record = await ctx.db
        .query("passwordResetTokens")
        .withIndex("by_token", (q) => q.eq("token", args.token!))
        .first();

      if (record && !record.used && record.expiresAt > Date.now()) {
        return { valid: true, email: record.email };
      }
    }

    if (args.code && args.email) {
      const cleanEmail = args.email.trim().toLowerCase();
      const record = await ctx.db
        .query("passwordResetTokens")
        .withIndex("by_code", (q) => q.eq("code", args.code!))
        .first();

      if (record && record.email === cleanEmail && !record.used && record.expiresAt > Date.now()) {
        return { valid: true, email: record.email };
      }
    }

    return { valid: false };
  },
});

/**
 * 3. Validation finale et mise à jour sécurisée du mot de passe
 */
export const completePasswordReset = mutation({
  args: {
    token: v.optional(v.string()),
    code: v.optional(v.string()),
    email: v.optional(v.string()),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.newPassword || args.newPassword.length < 6) {
      throw new Error("Le nouveau mot de passe doit comporter au moins 6 caractères.");
    }

    let resetRecord: any = null;

    // A. Recherche par jeton d'URL
    if (args.token) {
      resetRecord = await ctx.db
        .query("passwordResetTokens")
        .withIndex("by_token", (q) => q.eq("token", args.token!))
        .first();
    }
    // B. Recherche par code OTP à 6 chiffres
    else if (args.code && args.email) {
      const cleanEmail = args.email.trim().toLowerCase();
      const match = await ctx.db
        .query("passwordResetTokens")
        .withIndex("by_code", (q) => q.eq("code", args.code!))
        .first();

      if (match && match.email === cleanEmail) {
        resetRecord = match;
      }
    }

    if (!resetRecord || resetRecord.used || resetRecord.expiresAt < Date.now()) {
      throw new Error("Le lien ou code de réinitialisation est invalide ou a expiré. Veuillez refaire une demande.");
    }

    // Trouver l'utilisateur associé
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", resetRecord.email))
      .first();

    if (!user) {
      throw new Error("Compte utilisateur introuvable.");
    }

    // Hacher le nouveau mot de passe
    const passwordHash = await hashPassword(args.newPassword);

    // Mettre à jour l'utilisateur
    await ctx.db.patch(user._id, { passwordHash });

    // Marquer le jeton de réinitialisation comme utilisé
    await ctx.db.patch(resetRecord._id, { used: true });

    // Invalider les sessions antérieures pour forcer une connexion sécurisée
    const oldSessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const s of oldSessions) {
      await ctx.db.delete(s._id);
    }

    // Créer une nouvelle session active immédiate (durée 30 jours)
    const sessionToken = generateToken();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

    await ctx.db.insert("sessions", {
      token: sessionToken,
      userId: user._id,
      expiresAt,
      createdAt: Date.now(),
    });

    return {
      success: true,
      token: sessionToken,
      user,
    };
  },
});
