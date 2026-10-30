"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useAuth } from "@/lib/auth-context";
import { VerifiedTicker } from "@/components/ui/VerifiedTicker";
import {
  Car,
  MapPin,
  Clock,
  Calendar,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  Check,
  X,
  Sparkles,
  MoreHorizontal,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { reverseGeocode, getDistanceMeters, formatDistance } from "@/lib/geo";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDemandTargetDate } from "@/lib/dates";


// Formatage date locale YYYY-MM-DD
function getLocalDateString(ts: number | Date) {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Formatage heure lisible "05h"
function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}h`;
}

// Heures disponibles pour le sélecteur
const START_HOURS = Array.from({ length: 24 }, (_, i) => i); // 0 à 23
const END_HOURS = Array.from({ length: 24 }, (_, i) => i + 1); // 1 à 24

function RideResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token } = useAuth();
  const { toast } = useToast();

  // Paramètres de recherche récupérés depuis l'URL
  const fromLat = parseFloat(searchParams.get("fromLat") || "48.8566");
  const fromLng = parseFloat(searchParams.get("fromLng") || "2.3522");
  const initialFromAddress = searchParams.get("fromAddress") || "";
  const [fromAddress, setFromAddress] = useState(initialFromAddress);
  const toLat = parseFloat(searchParams.get("toLat") || "48.8566");
  const toLng = parseFloat(searchParams.get("toLng") || "2.3522");
  const toAddress = searchParams.get("toAddress") || "Église";
  const searchDate = searchParams.get("date") || "";
  const requestedSeats = parseInt(searchParams.get("seats") || "1", 10) || 1;

  // Résolution automatique d'une vraie adresse postale si non renseignée
  useEffect(() => {
    if (!initialFromAddress || initialFromAddress.includes("GPS") || initialFromAddress.includes("position")) {
      reverseGeocode(fromLat, fromLng).then((addr) => {
        if (addr) setFromAddress(addr);
      });
    }
  }, [fromLat, fromLng, initialFromAddress]);

  // Tous les trajets disponibles récupérés en temps réel
  const availableTrips = useQuery(api.trips.listAvailableTrips, token ? { token } : "skip");
  const createRequest = useMutation(api.requests.createRequest);

  // Filtre d'heure : Plage horaire personnalisée (par défaut : 05h à 24h)
  const [startHour, setStartHour] = useState<number>(5);
  const [endHour, setEndHour] = useState<number>(24);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);

  // Tri des résultats
  const [sortBy, setSortBy] = useState<"distance" | "time" | "seats">("distance");
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Modale de réservation pour un trajet sélectionné (par défaut 1 place)
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  const [bookingSeats, setBookingSeats] = useState<number>(1);
  const [bookingNote, setBookingNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modale pour signaler son besoin de trajet (avec informations déjà renseignées)
  const [showNeedModal, setShowNeedModal] = useState(false);
  const [needSeats, setNeedSeats] = useState<number>(requestedSeats || 1);
  const [needStartHour, setNeedStartHour] = useState<number>(5);
  const [needEndHour, setNeedEndHour] = useState<number>(24);
  const [needNote, setNeedNote] = useState("");
  const [isSubmittingNeed, setIsSubmittingNeed] = useState(false);
  const todayStr = useMemo(() => getLocalDateString(Date.now()), []);
  const [needDate, setNeedDate] = useState<string>(searchDate || todayStr);

  useEffect(() => {
    if (searchDate) setNeedDate(searchDate);
  }, [searchDate]);

  // Formatage de l'heure : "08:45"
  const formatHour = (ts: number) => {
    return new Date(ts).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Libellé de la date affichée sur la pilule
  const dateDisplayLabel = useMemo(() => {
    if (!searchDate) return "Aujourd'hui";
    const today = getLocalDateString(Date.now());
    if (searchDate === today) return "Aujourd'hui";

    const tomorrow = getLocalDateString(Date.now() + 86400000);
    if (searchDate === tomorrow) return "Demain";

    try {
      const [y, m, d] = searchDate.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    } catch {
      return searchDate;
    }
  }, [searchDate]);

  // Filtrage et calcul des correspondances
  const processedTrips = useMemo(() => {
    if (!availableTrips) return { inZone: [], nearby: [] };

    const now = Date.now();

    // 1. Filtrer les trajets valides
    const filtered = availableTrips
      .filter((trip) => {
        // Exclure les trajets terminés, annulés, ou non démarrés 45 min après l'heure prévue
        if (trip.status === "completed" || trip.status === "cancelled") return false;
        if (trip.status === "planned" && now > trip.departureTime + 45 * 60 * 1000) return false;
        if (trip.availableSeats < requestedSeats) return false;

        // Filtrer par date si spécifiée
        if (searchDate) {
          const tripDateStr = getLocalDateString(trip.departureTime);
          if (tripDateStr !== searchDate) return false;
        }

        // Filtrer par plage horaire spécifiée (startHour à endHour)
        const tripDate = new Date(trip.departureTime);
        const tripHour = tripDate.getHours() + tripDate.getMinutes() / 60;

        // Début de plage
        if (tripHour < startHour) return false;
        // Fin de plage (si endHour === 24, on accepte tout jusqu'à minuit 23h59)
        if (endHour < 24 && tripHour > endHour) return false;

        return true;
      })
      .map((trip) => {
        // Distance entre le lieu de départ du passager et le départ du conducteur
        const distanceMeters = getDistanceMeters(
          fromLat,
          fromLng,
          trip.departureLocation.lat,
          trip.departureLocation.lng
        );

        // Rayon toléré configuré par le conducteur (défaut: 500 m)
        const driverRadius = trip.pickupRadiusMeters ?? 500;

        // Le lieu de départ du passager entre-t-il dans la zone tolérée ?
        const inZone = distanceMeters <= driverRadius;

        return {
          ...trip,
          distanceMeters,
          driverRadius,
          inZone,
        };
      });

    // 2. Trier selon le critère choisi
    filtered.sort((a, b) => {
      if (sortBy === "distance") return a.distanceMeters - b.distanceMeters;
      if (sortBy === "time") return a.departureTime - b.departureTime;
      return b.availableSeats - a.availableSeats;
    });

    // 3. Séparer les trajets dans la zone tolérée et les autres trajets à proximité
    const inZone = filtered.filter((t) => t.inZone);
    const nearby = filtered.filter((t) => !t.inZone);

    return { inZone, nearby };
  }, [availableTrips, fromLat, fromLng, requestedSeats, searchDate, startHour, endHour, sortBy]);

  // Envoi de la demande de réservation
  const handleConfirmBooking = async () => {
    if (!token) {
      toast.info("Veuillez vous connecter pour réserver ce trajet.");
      router.push("/login");
      return;
    }
    if (!selectedTrip) return;

    setIsSubmitting(true);
    try {
      await createRequest({
        token,
        tripId: selectedTrip._id,
        pickupLocation: {
          lat: fromLat,
          lng: fromLng,
          address: fromAddress || "Lieu de prise en charge convenu",
        },
        destinationLocation: {
          lat: toLat,
          lng: toLng,
          address: toAddress || selectedTrip.destinationLocation.address,
        },
        seatsRequested: bookingSeats,
        note: bookingNote.trim() || undefined,
      });

      setSelectedTrip(null);
      toast.success("Demande envoyée au conducteur !");
      router.push("/needs?tab=my");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la réservation");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Envoi du besoin de trajet ouvert (pré-rempli avec les infos de recherche)
  const handleConfirmNeed = async () => {
    if (!token) {
      toast.info("Veuillez vous connecter pour publier votre besoin.");
      router.push("/login");
      return;
    }

    setIsSubmittingNeed(true);
    try {
      const slotText = `${formatHourLabel(needStartHour)} - ${formatHourLabel(needEndHour)}`;
      const targetDateLabel = formatDemandTargetDate(needDate);
      const timeNote = `Date souhaitée : ${targetDateLabel} • Créneau : ${slotText}`;
      const fullNote = needNote.trim() ? `${needNote.trim()} (${timeNote})` : timeNote;

      let resolvedPickup = fromAddress;
      if (!resolvedPickup || resolvedPickup.includes("GPS") || resolvedPickup.includes("position")) {
        try {
          resolvedPickup = await reverseGeocode(fromLat, fromLng);
        } catch {}
      }

      const newRequestId = await createRequest({
        token,
        pickupLocation: {
          lat: fromLat,
          lng: fromLng,
          address: resolvedPickup || "Lieu de prise en charge",
        },
        destinationLocation: {
          lat: toLat,
          lng: toLng,
          address: toAddress || "Église Centrale de la Grâce",
        },
        seatsRequested: needSeats,
        desiredDate: needDate,
        desiredTimeSlot: slotText,
        note: fullNote,
      });

      setShowNeedModal(false);
      toast.success("Demande de trajet enregistrée !");
      if (newRequestId) {
        router.push(`/requests/${newRequestId}`);
      } else {
        router.push("/needs?tab=my");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la publication");
    } finally {
      setIsSubmittingNeed(false);
    }
  };

  // Navigation vers la page détaillée du trajet (Capture d'écran 2026-10-28)
  const handleOpenTripDetails = (tripId: string) => {
    const params = new URLSearchParams();
    params.set("fromLat", fromLat.toString());
    params.set("fromLng", fromLng.toString());
    if (fromAddress) params.set("fromAddress", fromAddress);
    params.set("toLat", toLat.toString());
    params.set("toLng", toLng.toString());
    if (toAddress) params.set("toAddress", toAddress);
    if (searchDate) params.set("date", searchDate);
    params.set("seats", requestedSeats.toString());
    router.push(`/rides/${tripId}?${params.toString()}`);
  };

  return (
    <div className="relative min-h-dvh bg-[#f0f4f8] text-slate-800 pb-16 select-none overflow-x-hidden">
      {/* Halos d'ambiance glassy subtils */}
      <div className="pointer-events-none fixed -top-24 -right-24 h-96 w-96 rounded-full bg-teal-200/25 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-1/2 -left-28 h-80 w-80 rounded-full bg-blue-100/35 blur-3xl z-0" />

      {/* 1. EN-TÊTE FIXE GLASSY ÉPURÉ */}
      <div
        className="sticky top-0 z-30 glass-panel bg-white/75 backdrop-blur-2xl border-b border-white/75 px-4 pb-2.5 shadow-2xs"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0.75rem))" }}
      >
        <div className="max-w-md mx-auto space-y-2.5">
          {/* Ligne titre avec retour */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/rides/search")}
              className="flex h-9 w-9 items-center justify-center rounded-2xl glass-card bg-white/80 text-slate-700 hover:text-[#1a3860] active:scale-95 transition-all shadow-2xs border border-white/90"
              title="Modifier la recherche"
            >
              <ChevronLeft className="h-4 w-4 stroke-[2.4]" />
            </button>
            <div>
              <h1 className="text-base font-bold text-[#1a3860] leading-tight">
                Trajets disponibles
              </h1>
              <p className="text-[11px] font-medium text-[#7d8fa5]">
                Autour de vous • Vers l'église
              </p>
            </div>
          </div>

          {/* 2. BARRE DE FILTRE DE L'HEURE (PLAGE HORAIRE 05h - 24h PAR DÉFAUT) */}
          <div className="flex items-center gap-2 relative">
            {/* Overlay transparent pour fermer les popovers au clic à l'extérieur */}
            {(showTimeDropdown || showSortMenu) && (
              <div
                onClick={() => {
                  setShowTimeDropdown(false);
                  setShowSortMenu(false);
                }}
                className="fixed inset-0 z-30 bg-black/10 backdrop-blur-[1px]"
              />
            )}

            {/* Bouton Pilule de Créneau Horaire */}
            <button
              onClick={() => {
                setShowTimeDropdown((v) => !v);
                setShowSortMenu(false);
              }}
              className="flex-1 h-9.5 px-3 rounded-2xl glass-card bg-white/80 hover:bg-white border border-white/90 flex items-center justify-between text-xs font-semibold text-[#1a3860] shadow-2xs transition-all active:scale-[0.99] z-20"
            >
              <div className="flex items-center gap-2 truncate">
                <Search className="h-3.5 w-3.5 text-[#1a3860] flex-shrink-0" />
                <span className="truncate">
                  {dateDisplayLabel} • {formatHourLabel(startHour)} - {formatHourLabel(endHour)}
                </span>
              </div>
              <span className="text-[9px] text-[#7d8fa5] font-semibold ml-1">
                {showTimeDropdown ? "▲" : "▼"}
              </span>
            </button>

            {/* Bouton Filtres / Options de tri */}
            <button
              onClick={() => {
                setShowSortMenu((v) => !v);
                setShowTimeDropdown(false);
              }}
              className={`h-9.5 w-9.5 rounded-2xl glass-card border border-white/90 flex items-center justify-center transition-all shadow-2xs active:scale-95 flex-shrink-0 z-20 ${
                showSortMenu || sortBy !== "distance"
                  ? "bg-[#175276] text-white"
                  : "bg-white/80 text-[#1a3860] hover:bg-white"
              }`}
              title="Trier les résultats"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 stroke-[2]" />
            </button>

            {/* Bulle Sélection d'Heure Épurée : De ... à ... */}
            {showTimeDropdown && (
              <div className="absolute left-0 top-12.5 z-40 rounded-2xl glass-panel bg-white/95 backdrop-blur-2xl border border-white/90 px-3 py-2 shadow-xl flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
                <span className="text-xs font-bold text-slate-500">De</span>
                <div className="relative">
                  <select
                    value={startHour}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setStartHour(val);
                      if (val >= endHour) {
                        setEndHour(Math.min(24, val + 1));
                      }
                    }}
                    className="h-8 pl-2.5 pr-6 rounded-xl bg-slate-100/90 border border-slate-200 text-xs font-bold text-[#1a3860] focus:outline-none appearance-none cursor-pointer"
                  >
                    {START_HOURS.map((h) => (
                      <option key={h} value={h}>
                        {formatHourLabel(h)}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-400 text-[9px]">
                    ▼
                  </div>
                </div>

                <span className="text-xs font-bold text-slate-500">à</span>
                <div className="relative">
                  <select
                    value={endHour}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setEndHour(val);
                      if (val <= startHour) {
                        setStartHour(Math.max(0, val - 1));
                      }
                    }}
                    className="h-8 pl-2.5 pr-6 rounded-xl bg-slate-100/90 border border-slate-200 text-xs font-bold text-[#1a3860] focus:outline-none appearance-none cursor-pointer"
                  >
                    {END_HOURS.filter((h) => h > startHour).map((h) => (
                      <option key={h} value={h}>
                        {formatHourLabel(h)}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-400 text-[9px]">
                    ▼
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTimeDropdown(false)}
                  className="h-8 w-8 rounded-xl bg-[#175276] text-white hover:bg-[#134260] active:scale-95 transition-all flex items-center justify-center shadow-xs flex-shrink-0 ml-0.5"
                  title="Fermer"
                >
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                </button>
              </div>
            )}

            {/* Popover Menu de Tri */}
            {showSortMenu && (
              <div className="absolute right-0 top-13 w-52 z-40 rounded-2xl glass-panel bg-white/95 backdrop-blur-2xl border border-white/90 p-2 shadow-xl space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <p className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                  Trier les trajets
                </p>
                <button
                  onClick={() => {
                    setSortBy("distance");
                    setShowSortMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                    sortBy === "distance"
                      ? "bg-[#175276] text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100/80"
                  }`}
                >
                  <span>Plus proches d'abord</span>
                  {sortBy === "distance" && <Check className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => {
                    setSortBy("time");
                    setShowSortMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                    sortBy === "time"
                      ? "bg-[#175276] text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100/80"
                  }`}
                >
                  <span>Heure de départ</span>
                  {sortBy === "time" && <Check className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => {
                    setSortBy("seats");
                    setShowSortMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                    sortBy === "seats"
                      ? "bg-[#175276] text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100/80"
                  }`}
                >
                  <span>Places disponibles</span>
                  {sortBy === "seats" && <Check className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. LISTE DES TRAJETS CORRESPONDANTS */}
      <div className="relative z-10 max-w-md mx-auto p-4 space-y-4">
        {availableTrips === undefined ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-[#175276]" />
          </div>
        ) : processedTrips.inZone.length === 0 && processedTrips.nearby.length === 0 ? (
          /* AUCUN TRAJET CORRESPONDANT */
          <div className="rounded-3xl glass-card bg-white/85 backdrop-blur-xl p-8 text-center border border-white/90 space-y-3 shadow-xs">
            <Car className="h-10 w-10 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-[#1a3860]">
              Aucun trajet disponible pour le moment
            </h3>
            <p className="text-xs text-[#7d8fa5] max-w-xs mx-auto">
              Aucun conducteur ne passe dans votre périmètre pour ce créneau. Vous pouvez publier une recherche libre.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  setNeedSeats(requestedSeats || 1);
                  setNeedStartHour(startHour);
                  setNeedEndHour(endHour);
                  setShowNeedModal(true);
                }}
                className="w-full py-3 rounded-2xl bg-[#38917d] hover:bg-[#2e7d6b] text-white text-xs font-bold shadow-md shadow-[#38917d]/20 transition-all active:scale-[0.99]"
              >
                Signaler mon besoin de trajet
              </button>
              <button
                onClick={() => router.push("/rides/search")}
                className="w-full py-3 rounded-2xl glass-card bg-slate-100 hover:bg-slate-200 text-[#1a3860] text-xs font-bold transition-all"
              >
                Modifier mes critères de recherche
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* SECTION 1 : TRAJETS DONT LE LIEU DE DÉPART ENTRE DANS LA ZONE TOLÉRÉE */}
            {processedTrips.inZone.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 px-1">
                  <Sparkles className="h-3 w-3 text-[#138872]" />
                  <span className="text-[11px] font-bold text-[#138872] tracking-wide">
                    Dans votre zone de prise en charge ({processedTrips.inZone.length})
                  </span>
                </div>

                {processedTrips.inZone.map((trip) => (
                  <div
                    key={trip._id}
                    onClick={() => handleOpenTripDetails(trip._id)}
                    className="rounded-3xl glass-card bg-white/75 hover:bg-white/95 backdrop-blur-2xl p-4 border border-white/85 shadow-2xs space-y-2.5 transition-all cursor-pointer group active:scale-[0.99]"
                  >
                    {/* Ligne 1 : Conducteur + Note + Options */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Avatar circulaire du conducteur */}
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 ring-2 ring-white shadow-xs overflow-hidden flex-shrink-0">
                          {trip.driver?.avatarUrl ? (
                            <img
                              src={trip.driver.avatarUrl}
                              alt={trip.driver.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-bold text-[#175276]">
                              {trip.driver?.name?.charAt(0) || "C"}
                            </span>
                          )}
                        </div>

                        {/* Nom & Rôle */}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[#1a3860] group-hover:text-blue-600 transition-colors">
                              {trip.driver?.name || "Conducteur"}
                            </span>
                            <VerifiedTicker status={trip.driver?.status} />
                          </div>
                          <p className="text-[10px] text-[#7d8fa5] mt-0.5">
                            ⭐ 4,8 (24) • Conducteur
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-[#7d8fa5]">
                          {formatDistance(trip.distanceMeters)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#1a3860] transition-colors" />
                      </div>
                    </div>

                    {/* Ligne 2 : Nombre de places disponibles avec icône voiture */}
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#1a3860]">
                      <Car className="h-3.5 w-3.5 text-[#138872] stroke-[2]" />
                      <span>{trip.availableSeats} {trip.availableSeats > 1 ? "places disponibles" : "place disponible"}</span>
                    </div>

                    {/* Ligne 3 : Départ, Heure & Adresse */}
                    <div className="space-y-1 pt-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-[#2d6cb5] flex-shrink-0" />
                          <span className="text-[11px] font-semibold text-[#1a3860]">
                            Départ : {formatHour(trip.departureTime)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pl-5">
                        <p className="text-[11px] text-[#7d8fa5] truncate max-w-[210px]">
                          {trip.departureLocation.address}
                        </p>

                        {/* Badge de statut */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#e6f4f0] text-[#138872] border border-[#cce8e0] shadow-2xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#138872]" />
                          <span>
                            {trip.status === "active" ? "En route" : "Disponible"}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SECTION 2 : AUTRES TRAJETS DISPONIBLES À PROXIMITÉ (HORS RAYON TOLÉRÉ EXACT) */}
            {processedTrips.nearby.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <div className="px-1">
                  <span className="text-[11px] font-bold text-[#7d8fa5] tracking-wide">
                    {processedTrips.inZone.length > 0
                      ? `Autres trajets à proximité (${processedTrips.nearby.length})`
                      : `Trajets disponibles à proximité (${processedTrips.nearby.length})`}
                  </span>
                </div>

                {processedTrips.nearby.map((trip) => (
                  <div
                    key={trip._id}
                    onClick={() => handleOpenTripDetails(trip._id)}
                    className="rounded-3xl glass-card bg-white/70 hover:bg-white/95 backdrop-blur-2xl p-4 border border-white/80 shadow-2xs space-y-2.5 transition-all cursor-pointer group active:scale-[0.99]"
                  >
                    {/* Conducteur */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 ring-2 ring-white shadow-xs overflow-hidden flex-shrink-0">
                          {trip.driver?.avatarUrl ? (
                            <img
                              src={trip.driver.avatarUrl}
                              alt={trip.driver.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-bold text-[#175276]">
                              {trip.driver?.name?.charAt(0) || "C"}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[#1a3860] group-hover:text-blue-600 transition-colors">
                              {trip.driver?.name || "Conducteur"}
                            </span>
                            <VerifiedTicker status={trip.driver?.status} />
                          </div>
                          <p className="text-[10px] text-[#7d8fa5] mt-0.5">
                            ⭐ 4,8 (24) • Conducteur
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-[#7d8fa5]">
                          {formatDistance(trip.distanceMeters)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#1a3860] transition-colors" />
                      </div>
                    </div>

                    {/* Places */}
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#1a3860]">
                      <Car className="h-3.5 w-3.5 text-[#207567] stroke-[2]" />
                      <span>{trip.availableSeats} {trip.availableSeats > 1 ? "places disponibles" : "place disponible"}</span>
                    </div>

                    {/* Itinéraire */}
                    <div className="space-y-1 pt-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 truncate flex-1 pr-2">
                          <MapPin className="h-3.5 w-3.5 text-[#2d6cb5] flex-shrink-0" />
                          <span className="text-[11px] font-semibold text-[#1a3860]">
                            Départ : {formatHour(trip.departureTime)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pl-5">
                        <p className="text-[11px] text-[#7d8fa5] truncate max-w-[210px]">
                          {trip.departureLocation.address}
                        </p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#e6f4f0] text-[#138872] border border-[#cce8e0] shadow-2xs flex-shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#138872]" />
                          <span>Disponible</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 4. MODALE GLASSY : DEMANDE DE RÉSERVATION DE PLACE          */}
      {/* ============================================================ */}
      {selectedTrip && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-t-[36px] sm:rounded-3xl glass-panel bg-white/95 backdrop-blur-2xl border border-white/90 p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* En-tête */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-[#1a3860]">
                Réserver une place
              </h2>
              <button
                onClick={() => setSelectedTrip(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full glass-card bg-white/80 text-slate-500 hover:text-slate-800 hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Récapitulatif du conducteur */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#f8fafc] border border-slate-100">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 font-bold text-sm text-[#175276]">
                {selectedTrip.driver?.name?.charAt(0) || "C"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-[#1a3860]">
                    {selectedTrip.driver?.name || "Conducteur"}
                  </span>
                  <VerifiedTicker status={selectedTrip.driver?.status} />
                </div>
                <p className="text-xs text-[#7d8fa5]">
                  Départ prévu à {formatHour(selectedTrip.departureTime)}
                </p>
              </div>
            </div>

            {/* Récapitulatif de l'itinéraire */}
            <div className="space-y-2 p-3 rounded-2xl bg-white/80 border border-slate-200/80 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-[#138872] flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-400 block text-[10px]">Prise en charge</span>
                  <span className="font-bold text-[#1a3860]">
                    {fromAddress || "Votre lieu convenu"}
                  </span>
                  <span className="text-[10px] text-teal-700 block mt-0.5">
                    À {formatDistance(selectedTrip.distanceMeters)} du point de départ du conducteur
                  </span>
                </div>
              </div>

              <div className="ml-2 w-0.5 h-3 border-l-2 border-dashed border-slate-300" />

              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-[#2d6cb5] flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-400 block text-[10px]">Destination</span>
                  <span className="font-bold text-[#1a3860]">
                    {selectedTrip.destinationLocation.address}
                  </span>
                </div>
              </div>
            </div>

            {/* Nombre de places à réserver */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1a3860] flex items-center justify-between">
                <span>Nombre de places</span>
                <span className="text-[11px] text-[#7d8fa5]">
                  ({selectedTrip.availableSeats} disponibles)
                </span>
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4]
                  .filter((n) => n <= selectedTrip.availableSeats)
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

            {/* Message optionnel au conducteur */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1a3860] flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                <span>Message pour le conducteur (optionnel)</span>
              </label>
              <textarea
                value={bookingNote}
                onChange={(e) => setBookingNote(e.target.value)}
                placeholder="Ex: Je serai devant l'immeuble, merci beaucoup..."
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

      {/* ============================================================ */}
      {/* 5. MODALE GLASSY : SIGNALER MON BESOIN DE TRAJET (PRÉ-REMPLI) */}
      {/* ============================================================ */}
      {showNeedModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-t-[36px] sm:rounded-3xl glass-panel bg-white/95 backdrop-blur-2xl border border-white/90 p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* En-tête */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-base font-extrabold text-[#1a3860]">
                  Signaler mon besoin de trajet
                </h2>
                <p className="text-[11px] font-medium text-[#7d8fa5] mt-0.5">
                  Vos informations sont prêtes, vérifiez et validez
                </p>
              </div>
              <button
                onClick={() => setShowNeedModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full glass-card bg-white/80 text-slate-500 hover:text-slate-800 hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Récapitulatif du trajet */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-white/90 border border-slate-200/80 text-xs shadow-2xs">
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-[#138872] flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-semibold text-slate-400 block text-[10px] uppercase tracking-wider">
                    Lieu de prise en charge
                  </span>
                  <span className="font-bold text-[#1a3860] block truncate">
                    {fromAddress || "Lieu de prise en charge"}
                  </span>
                </div>
              </div>

              <div className="ml-2 w-0.5 h-3 border-l-2 border-dashed border-slate-300" />

              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-[#2d6cb5] flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-semibold text-slate-400 block text-[10px] uppercase tracking-wider">
                    Destination
                  </span>
                  <span className="font-bold text-[#1a3860] block truncate">
                    {toAddress || "Église Centrale de la Grâce"}
                  </span>
                </div>
              </div>
            </div>

            {/* Date et Plage horaire modifiable */}
            <div className="space-y-2">
              <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Date pour laquelle le trajet est demandé
                  </span>
                  <span className="text-xs font-black text-[#138872]">
                    {formatDemandTargetDate(needDate)}
                  </span>
                </div>
                <div className="relative flex items-center">
                  <Calendar className="absolute left-3 h-4 w-4 text-[#138872] pointer-events-none" />
                  <input
                    type="date"
                    value={needDate}
                    min={todayStr}
                    onChange={(e) => setNeedDate(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-bold text-[#1a3860] focus:outline-none focus:ring-2 focus:ring-[#138872]/20 focus:border-[#138872]"
                  />
                </div>
              </div>

              {/* Plage horaire modifiable */}
              <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Clock className="h-3.5 w-3.5 text-[#138872]" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Plage horaire souhaitée
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-[#138872]">
                    {formatHourLabel(needStartHour)} - {formatHourLabel(needEndHour)}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-xs font-bold text-slate-500">De</span>
                  <div className="relative flex-1">
                    <select
                      value={needStartHour}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setNeedStartHour(val);
                        if (val >= needEndHour) {
                          setNeedEndHour(Math.min(24, val + 1));
                        }
                      }}
                      className="w-full h-8.5 pl-2.5 pr-6 rounded-xl bg-white border border-slate-200 text-xs font-bold text-[#1a3860] focus:outline-none appearance-none cursor-pointer"
                    >
                      {START_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {formatHourLabel(h)}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 text-[9px]">
                      ▼
                    </div>
                  </div>

                  <span className="text-xs font-bold text-slate-500">à</span>
                  <div className="relative flex-1">
                    <select
                      value={needEndHour}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setNeedEndHour(val);
                        if (val <= needStartHour) {
                          setNeedStartHour(Math.max(0, val - 1));
                        }
                      }}
                      className="w-full h-8.5 pl-2.5 pr-6 rounded-xl bg-white border border-slate-200 text-xs font-bold text-[#1a3860] focus:outline-none appearance-none cursor-pointer"
                    >
                      {END_HOURS.filter((h) => h > needStartHour).map((h) => (
                        <option key={h} value={h}>
                          {formatHourLabel(h)}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 text-[9px]">
                      ▼
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Nombre de places demandées */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1a3860] flex items-center justify-between">
                <span>Nombre de places</span>
                <span className="text-[11px] text-[#7d8fa5] font-semibold">
                  ({needSeats} pers.)
                </span>
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNeedSeats(n)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      needSeats === n
                        ? "bg-[#138872] text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Précisions optionnelles */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1a3860] flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-[#138872]" />
                <span>Précisions (optionnel)</span>
              </label>
              <textarea
                value={needNote}
                onChange={(e) => setNeedNote(e.target.value)}
                placeholder={`Ex : Prêt entre ${formatHourLabel(needStartHour)} et ${formatHourLabel(needEndHour)}...`}
                rows={2}
                className="w-full rounded-2xl border border-slate-200/80 bg-white/90 p-3 text-xs text-slate-800 shadow-2xs focus:border-[#138872] focus:outline-none"
              />
            </div>

            {/* Bouton de confirmation */}
            <button
              onClick={handleConfirmNeed}
              disabled={isSubmittingNeed}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#138872] to-[#249e83] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#138872]/25 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
            >
              {isSubmittingNeed ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4 stroke-[2.5]" />
              )}
              <span>Valider mon besoin de trajet</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RideResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#f4f7fb]">
          <Loader2 className="h-7 w-7 animate-spin text-[#175276]" />
        </div>
      }
    >
      <RideResultsContent />
    </Suspense>
  );
}
