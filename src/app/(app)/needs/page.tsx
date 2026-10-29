"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/navigation/BottomNav";
import { VerifiedTicker } from "@/components/ui/VerifiedTicker";
import { Id } from "../../../../convex/_generated/dataModel";
import { reverseGeocode } from "@/lib/geo";
import { useToast } from "@/components/ui/ToastProvider";
import {
  Heart,
  Plus,
  MapPin,
  Clock,
  Calendar,
  Users,
  ChevronRight,
  Loader2,
  Car,
  X,
  Check,
  Compass,
  ArrowRight,
  Search,
} from "lucide-react";

// Formatage du temps écoulé lisible : "Ajoutée il y a 15 min"
function formatRelativeAdded(timestamp: number, currentTime: number) {
  const diffMs = Math.max(0, currentTime - timestamp);
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Ajoutée à l'instant";
  if (diffMin < 60) return `Ajoutée il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Ajoutée il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Ajoutée il y a ${diffDays} j`;
}

// Formatage de la date lisible : "Dim. 26 oct. à 09:30"
function formatDemandDate(timestamp: number) {
  const d = new Date(timestamp);
  const day = d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day.charAt(0).toUpperCase() + day.slice(1)} à ${time}`;
}

// Extraction du créneau éventuel ("Créneau : 08h - 10h")
function parseDemandTimeSlot(note?: string) {
  if (!note) return null;
  const match = note.match(/Créneau\s*:\s*(\d+)h\s*-\s*(\d+)h/i);
  if (match) {
    return {
      startHour: parseInt(match[1], 10),
      endHour: parseInt(match[2], 10),
      label: `${match[1]}h - ${match[2]}h`,
    };
  }
  return null;
}

function DemandsContent() {
  const { user, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Onglet : "my" (Mes demandes) ou "others" (Autres demandes)
  const initialTab = searchParams.get("tab") === "others" ? "others" : "my";
  const [activeTab, setActiveTab] = useState<"my" | "others">(initialTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "others") setActiveTab("others");
    else if (tab === "my") setActiveTab("my");
  }, [searchParams]);

  // Données des demandes séparées
  const demands = useQuery(api.requests.listDemands, token ? { token } : "skip");

  // Création automatique de trajet lors de la prise en charge
  const proposePickUpAndCreateTrip = useMutation(api.requests.proposePickUpAndCreateTrip);
  const [processingNeedId, setProcessingNeedId] = useState<string | null>(null);

  // Choix de l'heure par le conducteur avant confirmation
  const [selectedNeedForSchedule, setSelectedNeedForSchedule] = useState<any | null>(null);
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [pickupDate, setPickupDate] = useState(todayStr);

  const defaultInitialTime = useMemo(() => {
    const d = new Date(Date.now() + 15 * 60 * 1000);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(Math.ceil(d.getMinutes() / 5) * 5 % 60).padStart(2, "0");
    return `${h}:${m}`;
  }, []);
  const [pickupTime, setPickupTime] = useState(defaultInitialTime);

  // Heure actuelle mise à jour en temps réel
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenScheduleModal = (need: any) => {
    if (!token) {
      toast.info("Veuillez vous connecter pour proposer de récupérer ce passager.");
      router.push("/login");
      return;
    }
    setSelectedNeedForSchedule(need);
  };

  const handleConfirmSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedNeedForSchedule) return;

    if (!pickupDate || !pickupTime) {
      toast.error("Veuillez choisir une date et une heure de départ.");
      return;
    }

    const [y, m, d] = pickupDate.split("-").map(Number);
    const [hours, minutes] = pickupTime.split(":").map(Number);
    const chosenTimestamp = new Date(y, m - 1, d, hours, minutes, 0, 0).getTime();

    setProcessingNeedId(selectedNeedForSchedule._id);
    try {
      let lat: number | undefined;
      let lng: number | undefined;

      if (user?.homeAddress?.lat && user?.homeAddress?.lng) {
        lat = user.homeAddress.lat;
        lng = user.homeAddress.lng;
      }

      if (!lat || !lng) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 6000,
            });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch {
          lat = 48.8566;
          lng = 2.3522;
        }
      }

      let address = "";
      try {
        address = await reverseGeocode(lat, lng);
      } catch {
        address = user?.homeAddress?.address || "Lieu de départ du conducteur";
      }

      const tripId = await proposePickUpAndCreateTrip({
        token,
        requestId: selectedNeedForSchedule._id,
        departureTime: chosenTimestamp,
        driverLocation: {
          lat,
          lng,
          address: address || "Lieu de départ du conducteur",
        },
      });

      setSelectedNeedForSchedule(null);
      toast.success(
        `Trajet créé ! Le passager a été ajouté à votre véhicule.`
      );
      router.push(`/trips/${tripId}`);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création du trajet");
    } finally {
      setProcessingNeedId(null);
    }
  };

  return (
    <div className="relative min-h-dvh bg-[#f4f7fb] text-slate-800 pb-24 select-none overflow-x-hidden">
      {/* Halos d'ambiance glassy subtils */}
      <div className="pointer-events-none fixed -top-24 -right-24 h-96 w-96 rounded-full bg-teal-200/25 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-1/2 -left-28 h-80 w-80 rounded-full bg-blue-100/35 blur-3xl z-0" />

      {/* 1. EN-TÊTE FIXE GLASSY */}
      <div
        className="sticky top-0 z-30 glass-panel bg-white/80 backdrop-blur-2xl border-b border-white/80 px-4 pb-3 shadow-xs"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))" }}
      >
        <div className="max-w-md mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-black text-[#1a3860] tracking-tight">
                Demandes
              </h1>
              <p className="text-[11px] text-[#7d8fa5] font-medium">
                Demandes de covoiturage libres
              </p>
            </div>

            {/* Bouton Chercher un trajet */}
            <Link
              href="/rides/search"
              className="px-3 py-1.5 rounded-xl bg-[#175276] hover:bg-[#134260] text-white text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Chercher un trajet</span>
            </Link>
          </div>

          {/* LIGNE D'OPTIONS : Mes demandes / Autres demandes */}
          <div className="flex rounded-2xl bg-slate-100/90 p-1 border border-white/60">
            <button
              onClick={() => setActiveTab("my")}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "my"
                  ? "bg-white text-[#1a3860] shadow-sm"
                  : "text-[#6e8298] hover:text-[#1a3860]"
              }`}
            >
              <span>Mes demandes</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  activeTab === "my"
                    ? "bg-teal-100 text-[#138872]"
                    : "bg-slate-200/70 text-slate-600"
                }`}
              >
                {demands?.myDemands?.length ?? 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("others")}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "others"
                  ? "bg-white text-[#1a3860] shadow-sm"
                  : "text-[#6e8298] hover:text-[#1a3860]"
              }`}
            >
              <span>Autres demandes</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  activeTab === "others"
                    ? "bg-blue-100 text-[#175276]"
                    : "bg-slate-200/70 text-slate-600"
                }`}
              >
                {demands?.otherDemands?.length ?? 0}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* CONTENU PRINCIPAL */}
      <div className="relative z-10 max-w-md mx-auto p-4 space-y-3.5">
        {demands === undefined ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-[#175276]" />
          </div>
        ) : activeTab === "my" ? (
          /* ======================================================== */
          /* ONGLET 1 : MES DEMANDES (ALERTES & DEMANDES EN ATTENTE)    */
          /* ======================================================== */
          demands.myDemands.length === 0 ? (
            <div className="rounded-3xl glass-card bg-white/85 backdrop-blur-xl p-8 text-center border border-white/90 space-y-3 shadow-xs">
              <Compass className="h-10 w-10 mx-auto text-slate-300" />
              <h3 className="text-sm font-bold text-[#1a3860]">
                Aucune demande en cours
              </h3>
              <p className="text-xs text-[#7d8fa5] max-w-xs mx-auto">
                Vous n'avez pas de demande libre en attente de conducteur.
              </p>
              <div className="pt-2">
                <Link
                  href="/rides/search"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#175276] hover:bg-[#134260] text-white text-xs font-bold shadow-xs hover:opacity-95 transition-all"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Chercher un trajet</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {demands.myDemands.map((demand) => {
                const timeSlot = parseDemandTimeSlot(demand.note);
                return (
                  <div
                    key={demand._id}
                    onClick={() => router.push(`/requests/${demand._id}`)}
                    className="rounded-3xl glass-card bg-white/85 hover:bg-white/95 backdrop-blur-xl p-4 shadow-xs border border-white/90 space-y-3 transition-all cursor-pointer active:scale-[0.99] group"
                  >
                    {/* Ligne Statut & Date d'ajout */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-[#138872] text-white shadow-2xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        <span>En attente</span>
                      </span>

                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#175276]">
                        <Calendar className="h-3.5 w-3.5 text-[#249e83]" />
                        <span>{formatDemandDate(demand.createdAt)}</span>
                      </div>
                    </div>

                    {/* Créneau souhaité si renseigné */}
                    {timeSlot && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 text-[#175276] text-xs font-bold">
                        <Clock className="h-3.5 w-3.5 text-[#249e83]" />
                        <span>Créneau souhaité : {timeSlot.label}</span>
                      </div>
                    )}

                  {/* Itinéraire */}
                  <div className="space-y-1.5">
                    {/* Prise en charge */}
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-[#1a3860] block truncate">
                          {demand.pickupLocation.address}
                        </span>
                        <span className="text-[10px] text-[#7d8fa5] block">
                          Prise en charge
                        </span>
                      </div>
                    </div>

                    <div className="ml-1 w-0.5 h-3 border-l-2 border-dashed border-slate-300" />

                    {/* Destination */}
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-teal-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-[#1a3860] block truncate">
                          {demand.destinationLocation?.address || "Église (Centre-ville)"}
                        </span>
                        <span className="text-[10px] text-[#7d8fa5] block">
                          Destination
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bas de carte : Nombre de places & Bouton détails */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                      <Users className="h-3.5 w-3.5 text-[#175276]" />
                      <span>
                        {demand.seatsRequested} place{demand.seatsRequested > 1 ? "s" : ""}
                      </span>
                      {demand.note && (
                        <span className="text-[11px] text-slate-400 italic truncate max-w-[140px]">
                          • {demand.note}
                        </span>
                      )}
                    </div>

                    <div className="inline-flex items-center gap-1 text-xs font-bold text-[#175276] group-hover:text-[#249e83] transition-colors">
                      <span>Voir ma demande</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          )
        ) : (
          /* ======================================================== */
          /* ONGLET 2 : AUTRES DEMANDES (DEMANDES NON ASSOCIÉES)       */
          /* ======================================================== */
          demands.otherDemands.length === 0 ? (
            <div className="rounded-3xl glass-card bg-white/85 backdrop-blur-xl p-8 text-center border border-white/90 space-y-3 shadow-xs">
              <Heart className="h-10 w-10 mx-auto text-slate-300 stroke-[1.5]" />
              <h3 className="text-sm font-bold text-[#1a3860]">
                Aucune autre demande
              </h3>
              <p className="text-xs text-[#7d8fa5] max-w-xs mx-auto">
                Tous les paroissiens ont trouvé un covoiturage ou aucune demande libre n'est publiée pour le moment.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {demands.otherDemands.map((need) => {
                const timeSlot = parseDemandTimeSlot(need.note);
                return (
                  <div
                    key={need._id}
                    onClick={() => router.push(`/requests/${need._id}`)}
                    className="rounded-3xl glass-card bg-white/85 hover:bg-white/95 backdrop-blur-xl p-4 shadow-xs border border-white/90 space-y-3 cursor-pointer transition-all active:scale-[0.99] group"
                  >
                    {/* En-tête : Date visible de la demande */}
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-1.5 font-bold text-[#175276]">
                        <Calendar className="h-3.5 w-3.5 text-[#249e83]" />
                        <span>{formatDemandDate(need.createdAt)}</span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-400">
                        {formatRelativeAdded(need.createdAt, currentTime)}
                      </span>
                    </div>

                    {/* Passager & Places */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 ring-2 ring-white shadow-xs overflow-hidden flex-shrink-0">
                          {need.passenger?.avatarUrl ? (
                            <img
                              src={need.passenger.avatarUrl}
                              alt={need.passenger.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-bold text-[#175276]">
                              {need.passenger?.name?.charAt(0) || "P"}
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[#1a3860] group-hover:text-blue-600 transition-colors">
                              {need.passenger?.name || "Passager"}
                            </span>
                            <VerifiedTicker status={need.passenger?.status} size="xs" />
                          </div>
                          <p className="text-[11px] text-[#138872] font-semibold mt-0.5">
                            Demande {need.seatsRequested} place{need.seatsRequested > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] font-bold text-[#175276] group-hover:text-[#249e83] transition-colors">
                        <span className="text-xs">Voir détails</span>
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#175276] transition-colors" />
                      </div>
                    </div>

                    {/* Créneau souhaité si renseigné */}
                    {timeSlot && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 text-[#175276] text-xs font-bold">
                        <Clock className="h-3.5 w-3.5 text-[#249e83]" />
                        <span>Créneau souhaité : {timeSlot.label}</span>
                      </div>
                    )}

                    {/* Lieu de prise en charge & Remarque */}
                    <div className="rounded-2xl bg-slate-50/90 p-3 text-xs space-y-1.5 border border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <MapPin className="h-3.5 w-3.5 text-[#138872] flex-shrink-0" />
                        <span className="truncate font-medium">
                          {need.pickupLocation.address}
                        </span>
                      </div>

                      {need.note && (
                        <p className="text-[11px] text-slate-500 italic pl-5">
                          "{need.note}"
                        </p>
                      )}
                    </div>

                    {/* Bouton pour conducteur : Proposer de le récupérer (ouvre le choix de l'heure) */}
                    <div className="pt-1">
                      <button
                        type="button"
                        disabled={processingNeedId === need._id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenScheduleModal(need);
                        }}
                        className="w-full py-2.5 rounded-2xl bg-[#138872] hover:bg-[#0f725f] text-white text-xs font-bold shadow-sm shadow-[#138872]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Car className="h-3.5 w-3.5" />
                        <span>Proposer de le récupérer</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* MODALE POUR LE CONDUCTEUR : CHOIX DE L'HEURE AVANT CONFIRMATION */}
      {selectedNeedForSchedule && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Titre modale */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-[#138872]">
                  <Car className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1a3860]">
                    Récupérer {selectedNeedForSchedule.passenger?.name || "le passager"}
                  </h3>
                  <p className="text-[10px] text-[#7d8fa5]">
                    Définissez l'heure de départ de votre trajet
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNeedForSchedule(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Récapitulatif : Places & Itinéraire */}
            <div className="rounded-2xl bg-slate-50/90 p-3.5 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-[11px] font-bold text-[#7d8fa5] uppercase tracking-wider">
                  Places dans le trajet
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#e6f4f0] text-[#138872] font-bold text-xs border border-[#cce8e0]">
                  <Users className="h-3.5 w-3.5" />
                  <span>
                    {selectedNeedForSchedule.seatsRequested} place{selectedNeedForSchedule.seatsRequested > 1 ? "s" : ""}
                  </span>
                </span>
              </div>

              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-start gap-2 text-slate-700">
                  <div className="h-2 w-2 rounded-full bg-[#138872] flex-shrink-0 mt-1" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-medium">Prise en charge</span>
                    <span className="truncate font-semibold block text-slate-800">
                      {selectedNeedForSchedule.pickupLocation.address}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-slate-700">
                  <div className="h-2 w-2 rounded-full bg-[#175276] flex-shrink-0 mt-1" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-medium">Destination</span>
                    <span className="truncate font-semibold block text-slate-800">
                      {selectedNeedForSchedule.destinationLocation?.address || "Église (Centre-ville)"}
                    </span>
                  </div>
                </div>
              </div>

              {selectedNeedForSchedule.note && (
                <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/60">
                  "{selectedNeedForSchedule.note}"
                </p>
              )}
            </div>

            {/* Formulaire choix de l'heure */}
            <form onSubmit={handleConfirmSchedule} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                {/* Date */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#1a3860]">
                    Date du départ
                  </label>
                  <div className="relative flex items-center">
                    <Calendar className="absolute left-3 h-4 w-4 text-[#175276] pointer-events-none" />
                    <input
                      type="date"
                      required
                      min={todayStr}
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 py-2.5 pl-9 pr-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#175276]/30"
                    />
                  </div>
                </div>

                {/* Heure */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#1a3860]">
                    Heure de départ
                  </label>
                  <div className="relative flex items-center">
                    <Clock className="absolute left-3 h-4 w-4 text-[#138872] pointer-events-none" />
                    <input
                      type="time"
                      required
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 py-2.5 pl-9 pr-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#138872]/30"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedNeedForSchedule(null)}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={processingNeedId === selectedNeedForSchedule._id}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] hover:opacity-95 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {processingNeedId === selectedNeedForSchedule._id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span>Confirmer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barre de navigation inférieure */}
      <BottomNav userRole={user?.role ?? "user"} />
    </div>
  );
}

export default function DemandsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#f4f7fb]">
          <Loader2 className="h-7 w-7 animate-spin text-[#175276]" />
        </div>
      }
    >
      <DemandsContent />
    </Suspense>
  );
}
