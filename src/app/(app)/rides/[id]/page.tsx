"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useAuth } from "@/lib/auth-context";
import { VerifiedTicker } from "@/components/ui/VerifiedTicker";
import { useToast } from "@/components/ui/ToastProvider";
import {
  ArrowLeft,
  Users,
  Clock,
  Navigation,
  MapPin,
  Car,
  ChevronRight,
  Check,
  X,
  Loader2,
  MessageSquare,
} from "lucide-react";

// Calcul de distance en mètres selon la formule de Haversine
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Formatage lisible de la distance (ex: 800 m ou 2,1 km)
function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

function RideDetailsContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user, token } = useAuth();
  const { toast } = useToast();

  const tripId = params.id as Id<"trips">;

  // Paramètres passés depuis la recherche pour la prise en charge
  const fromLat = parseFloat(searchParams.get("fromLat") || "48.8566");
  const fromLng = parseFloat(searchParams.get("fromLng") || "2.3522");
  const fromAddress = searchParams.get("fromAddress") || "";
  const toLat = parseFloat(searchParams.get("toLat") || "48.8566");
  const toLng = parseFloat(searchParams.get("toLng") || "2.3522");
  const toAddress = searchParams.get("toAddress") || "";
  const requestedSeats = parseInt(searchParams.get("seats") || "1", 10) || 1;

  // Requêtes Convex
  const tripDetails = useQuery(
    api.trips.getTripDetails,
    tripId ? { tripId, token: token || undefined } : "skip"
  );
  const createRequest = useMutation(api.requests.createRequest);

  // État de la modale de réservation
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingSeats, setBookingSeats] = useState<number>(1);
  const [bookingNote, setBookingNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calcul de la distance entre le lieu de départ du passager et celui du conducteur
  const distanceToDriverMeters = useMemo(() => {
    if (!tripDetails) return 0;
    return getDistanceMeters(
      fromLat,
      fromLng,
      tripDetails.departureLocation.lat,
      tripDetails.departureLocation.lng
    );
  }, [tripDetails, fromLat, fromLng]);

  // Formatage de l'heure : "08:45"
  const formatHour = (ts: number) => {
    return new Date(ts).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Envoi de la demande de réservation
  const handleConfirmBooking = async () => {
    if (!token) {
      toast.info("Veuillez vous connecter pour demander une place.");
      router.push("/login");
      return;
    }
    if (!tripDetails) return;

    setIsSubmitting(true);
    try {
      await createRequest({
        token,
        tripId: tripDetails._id,
        pickupLocation: {
          lat: fromLat,
          lng: fromLng,
          address: fromAddress || tripDetails.departureLocation.address,
        },
        destinationLocation: {
          lat: toLat,
          lng: toLng,
          address: toAddress || tripDetails.destinationLocation.address,
        },
        seatsRequested: bookingSeats,
        note: bookingNote.trim() || undefined,
      });

      setShowBookingModal(false);
      toast.success("Demande envoyée au conducteur !");
      router.push("/needs?tab=my");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la réservation");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (tripDetails === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f4f7fb]">
        <Loader2 className="h-7 w-7 animate-spin text-[#175276]" />
      </div>
    );
  }

  if (tripDetails === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f7fb] p-6 text-center space-y-3">
        <Car className="h-10 w-10 text-slate-300" />
        <h2 className="text-sm font-bold text-[#1a3860]">Trajet introuvable</h2>
        <p className="text-xs text-[#7d8fa5]">Ce trajet n'est plus disponible ou a été annulé.</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-xl bg-[#175276] text-white text-xs font-bold"
        >
          Retour aux trajets
        </button>
      </div>
    );
  }

  const { driver } = tripDetails;
  const isDriver = user?._id === tripDetails.driverId;

  return (
    <div className="relative min-h-dvh bg-[#f4f7fb] text-slate-800 pb-28 select-none overflow-x-hidden">
      {/* Halos d'ambiance glassy subtils */}
      <div className="pointer-events-none fixed -top-20 -right-20 h-80 w-80 rounded-full bg-teal-200/25 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-1/3 -left-20 h-72 w-72 rounded-full bg-blue-100/35 blur-3xl z-0" />

      {/* 1. EN-TÊTE FIXE DU TEMPLATE : ← Détails du trajet */}
      <div
        className="sticky top-0 z-30 glass-panel bg-white/85 backdrop-blur-2xl border-b border-white/80 px-4 pb-3 shadow-2xs"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))" }}
      >
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-2xl glass-card bg-white/90 text-[#1a3860] hover:bg-white active:scale-95 transition-all shadow-2xs border border-white/90"
            title="Retour"
          >
            <ArrowLeft className="h-5 w-5 stroke-[2.2]" />
          </button>
          <h1 className="text-base font-bold text-[#1a3860]">
            Détails du trajet
          </h1>
        </div>
      </div>

      {/* CONTENU PRINCIPAL CONFORME À LA MAQUETTE */}
      <div className="relative z-10 max-w-md mx-auto p-4 space-y-3.5">
        {/* CARTE 1 : CONDUCTEUR, VÉHICULE ET STATS (3 COLONNES) */}
        <div className="rounded-3xl glass-card bg-white/90 backdrop-blur-xl p-5 border border-white/95 shadow-sm space-y-4">
          {/* Ligne conducteur */}
          <div className="flex items-center gap-3.5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 ring-2 ring-white shadow-xs overflow-hidden flex-shrink-0">
              {driver?.avatarUrl ? (
                <img
                  src={driver.avatarUrl}
                  alt={driver.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-lg font-black text-[#175276]">
                  {driver?.name?.charAt(0) || "C"}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-[#1a3860] truncate">
                  {driver?.name || "Conducteur"}
                </span>
                <VerifiedTicker status={driver?.status} />
              </div>
              <p className="text-xs text-[#7d8fa5] mt-0.5">
                ⭐ 4,8 (24) • Conducteur
              </p>
              <div className="flex items-center gap-1.5 text-xs text-[#7d8fa5] mt-1">
                <Car className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                <span className="truncate">Toyota Corolla • Blanc</span>
              </div>
            </div>
          </div>

          {/* Séparateur subtil */}
          <div className="border-t border-slate-100" />

          {/* Grille de 3 colonnes : Places / Départ / Distance */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 text-center pt-0.5">
            {/* Colonne 1 : Places */}
            <div className="space-y-1 px-1">
              <Users className="h-4 w-4 mx-auto text-blue-600" />
              <p className="text-xs font-bold text-[#1a3860]">
                {tripDetails.availableSeats} {tripDetails.availableSeats > 1 ? "places" : "place"}
              </p>
              <p className="text-[11px] text-[#7d8fa5]">
                disponibles
              </p>
            </div>

            {/* Colonne 2 : Heure de départ */}
            <div className="space-y-1 px-1">
              <Clock className="h-4 w-4 mx-auto text-blue-600" />
              <p className="text-[11px] text-[#7d8fa5]">
                Départ
              </p>
              <p className="text-xs font-bold text-[#1a3860]">
                {formatHour(tripDetails.departureTime)}
              </p>
            </div>

            {/* Colonne 3 : Distance */}
            <div className="space-y-1 px-1">
              <Navigation className="h-4 w-4 mx-auto text-blue-600 rotate-45" />
              <p className="text-xs font-bold text-[#1a3860]">
                {formatDistance(distanceToDriverMeters)}
              </p>
              <p className="text-[11px] text-[#7d8fa5]">
                de vous
              </p>
            </div>
          </div>
        </div>

        {/* CARTE 2 : TRAJET */}
        <div className="rounded-3xl glass-card bg-white/90 backdrop-blur-xl p-5 border border-white/95 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-[#1a3860]">
            Trajet
          </h2>

          <div className="space-y-2">
            {/* Étape Départ */}
            <div className="flex items-center justify-between group">
              <div className="flex items-start gap-3 min-w-0 pr-2">
                <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-700 flex-shrink-0">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[#1a3860] block truncate">
                    {tripDetails.departureLocation.address}
                  </span>
                  <span className="text-[11px] text-[#7d8fa5] block mt-0.5">
                    Départ
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
            </div>

            {/* Ligne de connexion verticale */}
            <div className="ml-3.5 w-0.5 h-4 bg-slate-200 rounded-full" />

            {/* Étape Arrivée */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 text-[#138872] flex-shrink-0">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-[#1a3860] block truncate">
                  {tripDetails.destinationLocation.address}
                </span>
                <span className="text-[11px] text-[#7d8fa5] block mt-0.5">
                  Arrivée
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CARTE 3 : À PROPOS */}
        <div className="rounded-3xl glass-card bg-white/90 backdrop-blur-xl p-5 border border-white/95 shadow-sm space-y-2">
          <h2 className="text-sm font-bold text-[#1a3860]">
            À propos
          </h2>
          <p className="text-xs text-[#4a5f78] leading-relaxed">
            {tripDetails.notes?.trim()
              ? tripDetails.notes
              : "Trajet convivial, n'hésitez pas à me contacter si vous avez des questions !"}
          </p>
        </div>
      </div>

      {/* 4. BOUTON PROÉMINENT DU BAS : Demander une place */}
      <div className="fixed bottom-0 inset-x-0 z-30 p-4 glass-panel bg-white/80 backdrop-blur-xl border-t border-white/80">
        <div className="max-w-md mx-auto">
          {isDriver ? (
            <div className="w-full py-3 rounded-2xl bg-slate-100 text-slate-500 text-xs font-bold text-center">
              Vous êtes le conducteur de ce trajet
            </div>
          ) : tripDetails.availableSeats <= 0 ? (
            <div className="w-full py-3 rounded-2xl bg-slate-100 text-slate-500 text-xs font-bold text-center">
              Complet (aucune place disponible)
            </div>
          ) : (
            <button
              onClick={() => {
                setBookingSeats(1);
                setShowBookingModal(true);
              }}
              className="w-full h-13 rounded-full bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] text-white text-sm font-bold shadow-lg shadow-[#1b7f80]/25 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span>Demander une place</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. MODALE GLASSY : CONFIRMATION DE DEMANDE DE PLACE (1 PAR DÉFAUT) */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-t-[36px] sm:rounded-3xl glass-panel bg-white/95 backdrop-blur-2xl border border-white/90 p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* En-tête */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-[#1a3860]">
                Réserver une place
              </h2>
              <button
                onClick={() => setShowBookingModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full glass-card bg-white/80 text-slate-500 hover:text-slate-800 hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Récapitulatif du conducteur */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#f8fafc] border border-slate-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 font-bold text-xs text-[#175276]">
                {driver?.name?.charAt(0) || "C"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#1a3860]">
                    {driver?.name || "Conducteur"}
                  </span>
                  <VerifiedTicker status={driver?.status} />
                </div>
                <p className="text-[11px] text-[#7d8fa5]">
                  Départ prévu à {formatHour(tripDetails.departureTime)}
                </p>
              </div>
            </div>

            {/* Nombre de places (1 par défaut) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1a3860] flex items-center justify-between">
                <span>Nombre de places</span>
                <span className="text-[11px] text-[#7d8fa5]">
                  ({tripDetails.availableSeats} disponibles)
                </span>
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4]
                  .filter((n) => n <= tripDetails.availableSeats)
                  .map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setBookingSeats(n)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                        bookingSeats === n
                          ? "bg-[#175276] text-white shadow-xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
              </div>
            </div>

            {/* Message optionnel */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1a3860] flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                <span>Message pour le conducteur (optionnel)</span>
              </label>
              <textarea
                value={bookingNote}
                onChange={(e) => setBookingNote(e.target.value)}
                placeholder="Ex : Je serai au point de rendez-vous convenu..."
                rows={2}
                className="w-full rounded-2xl border border-slate-200/80 bg-white/90 p-3 text-xs text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Bouton de confirmation */}
            <button
              onClick={handleConfirmBooking}
              disabled={isSubmitting}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#1b7f80]/25 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span>Confirmer ma demande</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RideDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#f4f7fb]">
          <Loader2 className="h-7 w-7 animate-spin text-[#175276]" />
        </div>
      }
    >
      <RideDetailsContent />
    </Suspense>
  );
}
