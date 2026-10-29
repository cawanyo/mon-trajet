import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser } from "./auth";

const DEFAULT_CHURCH = {
  name: "Église Centrale de la Grâce",
  address: "Église Centrale de la Grâce, 15 rue des Lilas, Paris",
  lat: 48.8566,
  lng: 2.3522,
};

// 1. Obtenir l'adresse de l'église configurée par le manager
export const getChurchSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("churchSettings").first();
    if (!settings) {
      return DEFAULT_CHURCH;
    }
    return {
      name: settings.name,
      address: settings.address,
      lat: settings.lat,
      lng: settings.lng,
    };
  },
});

// 2. Mettre à jour l'adresse de l'église (Manager ou Admin uniquement)
export const updateChurchSettings = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    address: v.string(),
    lat: v.number(),
    lng: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx, args.token);
    if (!user || (user.role !== "manager" && user.role !== "admin")) {
      throw new Error("Seul un responsable ou un administrateur peut modifier l'adresse de l'église.");
    }

    const existing = await ctx.db.query("churchSettings").first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        address: args.address,
        lat: args.lat,
        lng: args.lng,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("churchSettings", {
        name: args.name,
        address: args.address,
        lat: args.lat,
        lng: args.lng,
        updatedAt: Date.now(),
      });
    }
  },
});
