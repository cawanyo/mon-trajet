"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useAuth } from "@/lib/auth-context";
import {
  Check,
  MapPin,
  Users,
  Loader2,
  AlertCircle,
  Home,
  Eye,
} from "lucide-react";

function TripSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const tripId = searchParams.get("id") as Id<"trips"> | null;


  const trip = useQuery(
    api.trips.getTripDetails,
    tripId
      ? {
          token: token || undefined,
          tripId,
        }
      : "skip"
  );

  // Formatage de l'heure
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Formatage de la date lisible : ex "Sam. 25 oct. 2025"
  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const dayName = d.toLocaleDateString("fr-FR", { weekday: "short" });
    const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    const dayNum = d.getDate();
    const month = d.toLocaleDateString("fr-FR", { month: "short" });
    const year = d.getFullYear();
    return `${capitalizedDay} ${dayNum} ${month} ${year}`;
  };

  if (!tripId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6 text-center">
        <p className="text-sm text-slate-500 mb-4">Identifiant de trajet manquant.</p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 rounded-xl bg-[#2d6cb5] text-white text-xs font-bold"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  if (trip === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f4f7fb]">
        <Loader2 className="h-7 w-7 animate-spin text-[#2d6cb5]" />
      </div>
    );
  }

  if (trip === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="h-10 w-10 text-rose-500 mb-3" />
        <h1 className="text-lg font-bold text-slate-800">Trajet introuvable</h1>
        <button
          onClick={() => router.push("/")}
          className="mt-4 px-4 py-2 rounded-xl bg-[#2d6cb5] text-white text-xs font-bold"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-[#f4f8fb] text-slate-800 flex flex-col justify-between p-5 select-none overflow-x-hidden">
      {/* Halos d'ambiance pour accentuer l'effet verre dépoli */}
      <div className="pointer-events-none fixed -top-24 -right-24 h-96 w-96 rounded-full bg-teal-200/35 blur-3xl" />
      <div className="pointer-events-none fixed top-1/3 -left-28 h-80 w-80 rounded-full bg-blue-100/40 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-20 right-10 h-72 w-72 rounded-full bg-emerald-100/30 blur-3xl" />

      <div className="relative z-10 max-w-sm mx-auto w-full pt-5 sm:pt-14 space-y-8 flex-1 flex flex-col justify-center">
        {/* 1. GRAPHIQUE DE CONFIRMATION (CERCLE VERT GLOW & CONFETTIS) */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative flex items-center justify-center">
            {/* Particules décoratives colorées autour du cercle (vert, turquoise, bleu marine) */}
            <span className="absolute -top-2 left-3 h-2 w-2 rounded-full bg-[#3cd6a8]" />
            <span className="absolute top-1 -right-3 h-3 w-3 rounded-full bg-[#1a3860]" />
            <span className="absolute -bottom-1 -left-2 h-2.5 w-2.5 rounded-full bg-[#2cb693]" />
            <span className="absolute bottom-2 -right-4 h-2 w-2 rounded-full bg-[#3cd6a8]" />
            <span className="absolute -top-4 right-6 h-1.5 w-1.5 rounded-full bg-[#1c9878]" />
            <span className="absolute -bottom-3 right-8 h-2 w-2 rounded-full bg-[#62b9a7]" />
            <span className="absolute top-1/2 -left-6 h-1.5 w-1.5 rounded-full bg-[#7dd3c3]" />

            {/* Grand cercle vert émeraude vibrant */}
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-tr from-[#22a482] via-[#2ec49f] to-[#3cd6a8] text-white shadow-2xl shadow-[#2ec49f]/35 ring-8 ring-[#2ec49f]/15 animate-in zoom-in-75 duration-300">
              <Check className="h-14 w-14 stroke-[3.2]" />
            </div>
          </div>

          {/* Titre & Message de confirmation */}
          <div className="space-y-2 pt-1">
            <h1 className="text-2xl font-black text-[#1a3860] tracking-tight">
              Trajet publié !
            </h1>
            <p className="text-sm font-medium text-[#6e8298] leading-relaxed max-w-[270px] mx-auto">
              Votre trajet est maintenant visible pour les membres de la communauté.
            </p>
          </div>
        </div>

        {/* 2. CARTE RÉCAPITULATIVE DE L'ITINÉRAIRE (STYLE EXACT DU TEMPLATE) */}
        <div className="rounded-3xl glass-panel bg-white/85 backdrop-blur-2xl border border-white/90 shadow-md p-5 space-y-4">
          {/* Itinéraire avec points et ligne verticale */}
          <div className="space-y-1">
            {/* 1. Point de départ */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2.5">
                <MapPin className="h-5 w-5 text-[#1a3860] flex-shrink-0" />
                <span className="text-sm font-bold text-[#1a3860] truncate">
                  {trip.departureLocation.address}
                </span>
              </div>
              {/* Date & Heure sous le départ */}
              <div className="pl-7">
                <span className="text-xs font-semibold text-[#7d8fa5]">
                  {formatTime(trip.departureTime)} • {formatDate(trip.departureTime)}
                </span>
              </div>
            </div>

            {/* Ligne verticale de liaison */}
            <div className="ml-2.5 my-0.5 w-0.5 h-5 border-l-2 border-slate-300" />

            {/* 2. Point d'arrivée */}
            <div className="flex items-center gap-2.5">
              <MapPin className="h-5 w-5 text-[#1a3860] flex-shrink-0" />
              <span className="text-sm font-bold text-[#1a3860] truncate">
                {trip.destinationLocation.address}
              </span>
            </div>
          </div>

          {/* Ligne d'informations : Places disponibles & Statut */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#1a3860]">
              <Users className="h-4.5 w-4.5 text-[#1a3860]" />
              <span>
                {trip.availableSeats} {trip.availableSeats > 1 ? "places" : "place"}
              </span>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[#e6f4f0] text-[#138872] border border-[#cce8e0]/80 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-[#138872]" />
              <span>Disponible</span>
            </span>
          </div>
        </div>
      </div>

      {/* 3. BOUTONS D'ACTION INFÉRIEURS (IDENTIQUES AU TEMPLATE) */}
      <div className="relative z-10 max-w-sm mx-auto w-full pt-2 pb-2 space-y-3">
        {/* Bouton Principal : Voir mon trajet (redirige vers /trips/[id] avec la carte) */}
        <button
          onClick={() => router.push(`/trips/${trip._id}`)}
          className="w-full p-2 rounded-xl bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#1b7f80]/25 hover:opacity-95 active:scale-[0.98] transition-all"
        >
          <span>Voir mon trajet</span>
        </button>

        {/* Bouton Secondaire : Retour à l'accueil */}
        <button
          onClick={() => router.push("/")}
          className="w-full p-2 rounded-xl glass-card bg-white/85 hover:bg-white text-[#1a3860] text-sm font-bold flex items-center justify-center border border-slate-200/70 active:scale-[0.98] transition-all shadow-xs"
        >
          <span>Retour à l'accueil</span>
        </button>
      </div>
    </div>
  );
}

export default function TripSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#f4f8fb]">
          <Loader2 className="h-7 w-7 animate-spin text-[#2d6cb5]" />
        </div>
      }
    >
      <TripSuccessContent />
    </Suspense>
  );
}
