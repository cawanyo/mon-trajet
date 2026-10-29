import { mutation } from "./_generated/server";

export const seedDatabase = mutation({
  args: {},
  handler: async (ctx) => {
    // Vérifier si la base contient déjà des utilisateurs
    const existing = await ctx.db.query("users").take(1);
    if (existing.length > 0) {
      return { message: "Base de données déjà initialisée." };
    }

    const churchLocation = {
      lat: 48.8566,
      lng: 2.3522,
      address: "Église Centrale de la Grâce, 15 rue des Lilas",
    };

    // 1. Administrateur
    const adminId = await ctx.db.insert("users", {
      name: "Pasteur David (Admin)",
      email: "admin@eglise.fr",
      phoneNumber: "+33601020304",
      role: "admin",
      status: "approved",
      createdAt: Date.now(),
    });

    // 2. Responsable / Manager
    const managerId = await ctx.db.insert("users", {
      name: "Marc Responsable",
      email: "manager@eglise.fr",
      phoneNumber: "+33611223344",
      role: "manager",
      status: "approved",
      createdAt: Date.now(),
    });

    // 3. Conducteur avec trajet actif
    const driverId = await ctx.db.insert("users", {
      name: "Jean Conducteur",
      email: "jean@eglise.fr",
      phoneNumber: "+33655667788",
      role: "user",
      status: "approved",
      createdAt: Date.now(),
    });

    // 4. Passager en attente de validation (pour tester l'écran de validation Manager)
    const pendingPassengerId = await ctx.db.insert("users", {
      name: "Sophie Nouvelle",
      email: "sophie@eglise.fr",
      phoneNumber: "+33699887766",
      role: "user",
      status: "pending",
      createdAt: Date.now(),
    });

    // 5. Passager validé qui signale un besoin
    const activePassengerId = await ctx.db.insert("users", {
      name: "Marie Membre",
      email: "marie@eglise.fr",
      phoneNumber: "+33644332211",
      role: "user",
      status: "approved",
      createdAt: Date.now(),
    });

    // 6. Trajet proposé par Jean
    const tripDeparture = {
      lat: 48.8700,
      lng: 2.3800,
      address: "24 Avenue Gambetta, Belleville",
    };

    const tripId = await ctx.db.insert("trips", {
      driverId,
      departureLocation: tripDeparture,
      destinationLocation: churchLocation,
      departureTime: Date.now() + 2 * 3600 * 1000, // Dans 2 heures
      totalSeats: 4,
      availableSeats: 3,
      status: "planned",
      notes: "Départ pile à l'heure devant le métro. Coffre disponible.",
      createdAt: Date.now(),
    });

    // 7. Demande ouverte (Signal de besoin) émise par Marie
    await ctx.db.insert("requests", {
      passengerId: activePassengerId,
      pickupLocation: {
        lat: 48.8450,
        lng: 2.3700,
        address: "Gare de Lyon, Place Louis Armand",
      },
      status: "pending",
      seatsRequested: 1,
      note: "Je sors du travail à 9h30, avec une petite valise.",
      createdAt: Date.now(),
    });

    return {
      message: "Base initialisée avec succès !",
      adminEmail: "admin@eglise.fr",
      managerEmail: "manager@eglise.fr",
      driverEmail: "jean@eglise.fr",
      pendingEmail: "sophie@eglise.fr",
    };
  },
});
