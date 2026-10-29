"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/navigation/BottomNav";
import { VerifiedTicker } from "@/components/ui/VerifiedTicker";
import {
  Car,
  Users,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Plus,
} from "lucide-react";

function TripsContent() {
  const router = useRouter();
  const { user, token } = useAuth();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "passenger" ? "passenger" : "driver";
  const [activeTab, setActiveTab] = useState<"driver" | "passenger">(initialTab);
  const [statusFilter, setStatusFilter] = useState<"active" | "past" | "cancelled">("active");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "passenger") {
      setActiveTab("passenger");
    } else if (tab === "driver") {
      setActiveTab("driver");
    }
  }, [searchParams]);

  const myTrips = useQuery(api.trips.listMyTrips, token ? { token } : "skip");

  // Heure actuelle mise à jour en temps réel
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Formatage concis de la date : "Dim. 26 oct. à 09:30"
  const formatCompactDate = (ts: number) => {
    const d = new Date(ts);
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
  };

  // Filtrage des trajets Conducteur : heure dépassée = directement passé et inactif
  const filteredDriverTrips = useMemo(() => {
    if (!myTrips?.asDriver) return [];
    return myTrips.asDriver.filter((trip) => {
      const isPast = trip.status === "completed" || trip.departureTime < currentTime;
      if (statusFilter === "cancelled") {
        return trip.status === "cancelled";
      }
      if (statusFilter === "past") {
        return trip.status !== "cancelled" && isPast;
      }
      // "active" (par défaut) : actif uniquement si heure non dépassée et non annulé/terminé
      return trip.status !== "cancelled" && !isPast;
    });
  }, [myTrips?.asDriver, statusFilter, currentTime]);

  // Filtrage des trajets Passager : heure dépassée = directement passé et inactif
  // Les alertes et demandes non encore acceptées par un conducteur sont gérées dans la page "Demandes"
  const filteredPassengerTrips = useMemo(() => {
    if (!myTrips?.asPassenger) return [];
    return myTrips.asPassenger.filter(({ request, trip }) => {
      // Exclure toute demande sans trajet ou non validée par le conducteur
      if (!trip || (request.status !== "accepted" && request.status !== "cancelled")) {
        return false;
      }

      const isCancelled =
        request.status === "cancelled" || trip?.status === "cancelled";

      const isPast =
        trip && (trip.status === "completed" || trip.departureTime < currentTime);

      if (statusFilter === "cancelled") {
        return isCancelled;
      }
      if (statusFilter === "past") {
        return !isCancelled && isPast;
      }
      // "active" (par défaut)
      return !isCancelled && !isPast;
    });
  }, [myTrips?.asPassenger, statusFilter, currentTime]);

  // Comptages pour les filtres Conducteur
  const getDriverCount = (filter: "active" | "past" | "cancelled") => {
    if (!myTrips?.asDriver) return 0;
    return myTrips.asDriver.filter((trip) => {
      const isPast = trip.status === "completed" || trip.departureTime < currentTime;
      if (filter === "cancelled") return trip.status === "cancelled";
      if (filter === "past") return trip.status !== "cancelled" && isPast;
      return trip.status !== "cancelled" && !isPast;
    }).length;
  };

  // Comptages pour les filtres Passager
  const getPassengerCount = (filter: "active" | "past" | "cancelled") => {
    if (!myTrips?.asPassenger) return 0;
    return myTrips.asPassenger.filter(({ request, trip }) => {
      if (!trip || (request.status !== "accepted" && request.status !== "cancelled")) {
        return false;
      }

      const isCancelled =
        request.status === "cancelled" || trip?.status === "cancelled";

      const isPast =
        trip && (trip.status === "completed" || trip.departureTime < currentTime);

      if (filter === "cancelled") return isCancelled;
      if (filter === "past") return !isCancelled && isPast;
      return !isCancelled && !isPast;
    }).length;
  };

  return (
    <div className="relative min-h-screen bg-[#f4f7fb] text-slate-800 pb-24 select-none overflow-x-hidden">
      {/* Halos d'ambiance glassy */}
      <div className="pointer-events-none fixed -top-24 -right-24 h-96 w-96 rounded-full bg-teal-200/30 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-1/2 -left-28 h-80 w-80 rounded-full bg-blue-100/40 blur-3xl z-0" />

      {/* En-tête Glassy fixe */}
      <div className="sticky top-0 z-30 glass-panel bg-white/80 backdrop-blur-2xl border-b border-white/80 px-4 pt-4 pb-3 shadow-xs">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-black text-[#1a3860] tracking-tight">Mes Trajets</h1>
              <p className="text-[11px] text-[#7d8fa5] font-medium">Gérez vos trajets et réservations</p>
            </div>
            {/* Raccourci Proposer un trajet */}
            <Link
              href="/trips/create"
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] text-white text-xs font-bold shadow-xs hover:opacity-95 active:scale-95 transition-all flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Proposer</span>
            </Link>
          </div>

          {/* Onglets Rôle : Conducteur / Passager */}
          <div className="mt-3 flex rounded-2xl bg-slate-100/80 p-1 border border-white/60">
            <button
              onClick={() => setActiveTab("driver")}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "driver"
                  ? "bg-white text-[#1a3860] shadow-sm"
                  : "text-[#6e8298] hover:text-[#1a3860]"
              }`}
            >
              <span>Conducteur</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  activeTab === "driver"
                    ? "bg-blue-100 text-[#175276]"
                    : "bg-slate-200/70 text-slate-600"
                }`}
              >
                {myTrips?.asDriver.length ?? 0}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("passenger")}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "passenger"
                  ? "bg-white text-[#1a3860] shadow-sm"
                  : "text-[#6e8298] hover:text-[#1a3860]"
              }`}
            >
              <span>Passager</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  activeTab === "passenger"
                    ? "bg-emerald-100 text-[#138872]"
                    : "bg-slate-200/70 text-slate-600"
                }`}
              >
                {myTrips?.asPassenger.length ?? 0}
              </span>
            </button>
          </div>

          {/* Filtres de statut : Actif (défaut) | Passés | Annulés */}
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-0.5 no-scrollbar">
            {(["active", "past", "cancelled"] as const).map((filter) => {
              const label =
                filter === "active" ? "Actif" : filter === "past" ? "Passés" : "Annulés";
              const count =
                activeTab === "driver" ? getDriverCount(filter) : getPassengerCount(filter);
              const isSelected = statusFilter === filter;

              return (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isSelected
                      ? "bg-[#1a3860] text-white shadow-xs"
                      : "glass-card bg-white/70 hover:bg-white text-slate-600 hover:text-[#1a3860] border border-white/80"
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                      isSelected ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contenu de la liste des trajets */}
      <div className="relative z-10 p-4 max-w-md mx-auto">
        {myTrips === undefined ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#175276]" />
          </div>
        ) : activeTab === "driver" ? (
          /* ======================================================== */
          /* VUE CONDUCTEUR                                          */
          /* ======================================================== */
          filteredDriverTrips.length === 0 ? (
            <div className="rounded-3xl glass-card bg-white/80 backdrop-blur-xl p-8 text-center border border-white/90 space-y-3 shadow-xs">
              {statusFilter === "active" ? (
                <>
                  <Car className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-[#1a3860]">Aucun trajet actif planifié</p>
                  <p className="text-[11px] text-[#7d8fa5]">
                    Proposez un nouveau trajet pour emmener d'autres membres à l'église.
                  </p>
                  <Link
                    href="/trips/create"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] text-white text-xs font-bold shadow-xs hover:opacity-95 transition-all mt-1"
                  >
                    <span>Proposer un trajet</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </>
              ) : statusFilter === "past" ? (
                <>
                  <Clock className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-[#1a3860]">Aucun trajet passé</p>
                  <p className="text-[11px] text-[#7d8fa5]">
                    L'historique de vos trajets effectués s'affichera ici.
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-[#1a3860]">Aucun trajet annulé</p>
                  <p className="text-[11px] text-[#7d8fa5]">
                    Les trajets que vous annulez apparaîtront ici.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDriverTrips.map((trip) => {
                const pendingCount = trip.requests.filter((r) => r.status === "pending").length;
                const acceptedCount = trip.requests.filter((r) => r.status === "accepted").length;

                return (
                  <div
                    key={trip._id}
                    className="rounded-3xl glass-card bg-white/85 hover:bg-white/95 backdrop-blur-xl p-4 shadow-xs border border-white/90 space-y-3 transition-all"
                  >
                    {/* En-tête : Date & Statut */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#175276]">
                        <Clock className="h-3.5 w-3.5 text-[#249e83]" />
                        <span>{formatCompactDate(trip.departureTime)}</span>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shadow-2xs ${
                          trip.status === "cancelled"
                            ? "bg-rose-50 text-rose-600 border border-rose-200"
                            : trip.status === "completed" || trip.departureTime < currentTime
                            ? "bg-slate-100 text-slate-600 border border-slate-200"
                            : trip.availableSeats > 0
                            ? "bg-[#e6f4f0] text-[#138872] border border-[#cce8e0]"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {trip.status === "cancelled"
                          ? "Annulé"
                          : trip.status === "completed" || trip.departureTime < currentTime
                          ? "Passé"
                          : trip.availableSeats > 0
                          ? `${trip.availableSeats} pl. dispo`
                          : "Complet"}
                      </span>
                    </div>

                    {/* Itinéraire cliquable */}
                    <Link href={`/trips/${trip._id}`} className="block group space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />
                        <span className="text-xs font-bold text-[#1a3860] group-hover:text-blue-600 transition-colors truncate">
                          {trip.departureLocation.address}
                        </span>
                      </div>
                      <div className="ml-1 w-0.5 h-3 border-l-2 border-dashed border-slate-300" />
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-teal-600 flex-shrink-0" />
                        <span className="text-xs font-bold text-[#1a3860] group-hover:text-teal-600 transition-colors truncate">
                          {trip.destinationLocation.address}
                        </span>
                      </div>
                    </Link>

                    {/* Bas de carte : Alertes demandes & Accès au trajet */}
                    <div className="pt-2 border-t border-slate-100/90 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {pendingCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200/80">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>{pendingCount} demande{pendingCount > 1 ? "s" : ""}</span>
                          </span>
                        ) : acceptedCount > 0 ? (
                          <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{acceptedCount} passager{acceptedCount > 1 ? "s" : ""}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Aucune demande</span>
                        )}
                      </div>

                      <Link
                        href={`/trips/${trip._id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#175276] hover:text-[#249e83] transition-colors"
                      >
                        <span>Voir mon trajet</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* ======================================================== */
          /* VUE PASSAGER                                            */
          /* ======================================================== */
          filteredPassengerTrips.length === 0 ? (
            <div className="rounded-3xl glass-card bg-white/80 backdrop-blur-xl p-8 text-center border border-white/90 space-y-3 shadow-xs">
              {statusFilter === "active" ? (
                <>
                  <Users className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-[#1a3860]">Aucune réservation active</p>
                  <p className="text-[11px] text-[#7d8fa5]">
                    Recherchez un trajet disponible sur la carte pour aller à l'église.
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] text-white text-xs font-bold shadow-xs hover:opacity-95 transition-all mt-1"
                  >
                    <span>Trouver un trajet</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </>
              ) : statusFilter === "past" ? (
                <>
                  <Clock className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-[#1a3860]">Aucun trajet passé</p>
                  <p className="text-[11px] text-[#7d8fa5]">
                    Vos trajets effectués en tant que passager apparaîtront ici.
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-[#1a3860]">Aucune réservation annulée</p>
                  <p className="text-[11px] text-[#7d8fa5]">
                    Les demandes refusées ou annulées apparaîtront ici.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPassengerTrips.map(({ request, trip, driver }) => (
                <div
                  key={request._id}
                  onClick={() => {
                    if (trip) {
                      router.push(`/trips/${trip._id}?requestId=${request._id}`);
                    } else {
                      router.push(`/requests/${request._id}`);
                    }
                  }}
                  className="rounded-3xl glass-card bg-white/85 hover:bg-white/95 backdrop-blur-xl p-4 shadow-xs border border-white/90 space-y-3 transition-all cursor-pointer active:scale-[0.99] group"
                >
                  {/* En-tête : Date & Statut */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#175276]">
                      <Clock className="h-3.5 w-3.5 text-[#249e83]" />
                      <span>
                        {trip ? formatCompactDate(trip.departureTime) : "Signal de recherche"}
                      </span>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shadow-2xs ${
                        request.status === "accepted"
                          ? "bg-[#e6f4f0] text-[#138872] border border-[#cce8e0]"
                          : request.status === "pending"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : request.status === "cancelled"
                          ? "bg-slate-100 text-slate-600 border border-slate-200"
                          : "bg-rose-50 text-rose-600 border border-rose-200"
                      }`}
                    >
                      {request.status === "accepted"
                        ? "Validé"
                        : request.status === "pending"
                        ? "En attente"
                        : request.status === "cancelled"
                        ? "Annulé"
                        : "Refusé"}
                    </span>
                  </div>

                  {/* Itinéraire épuré */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />
                      <span className="text-xs font-bold text-[#1a3860] truncate">
                        {trip ? trip.departureLocation.address : request.pickupLocation.address}
                      </span>
                    </div>
                    {trip && (
                      <>
                        <div className="ml-1 w-0.5 h-3 border-l-2 border-dashed border-slate-300" />
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-teal-600 flex-shrink-0" />
                          <span className="text-xs font-bold text-[#1a3860] truncate">
                            {trip.destinationLocation.address}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Bas : Conducteur & Appel si validé */}
                  <div className="pt-2 border-t border-slate-100/90 flex items-center justify-between">
                    {driver ? (
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-[#175276]">
                          {driver.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-[#1a3860]">{driver.name}</span>
                            <VerifiedTicker status={driver.status} />
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {request.seatsRequested} {request.seatsRequested > 1 ? "places" : "place"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">En recherche de conducteur</span>
                    )}

                    {/* Bouton d'appel ou Détails */}
                    <div className="flex items-center gap-2">
                      {request.status === "accepted" && driver?.phoneNumber && (
                        <a
                          href={`tel:${driver.phoneNumber}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                          title="Appeler le conducteur"
                        >
                          <Phone className="h-3.5 w-3.5 fill-white" />
                          <span>Appeler</span>
                        </a>
                      )}
                      <div className="inline-flex items-center gap-1 text-xs font-bold text-[#175276] group-hover:text-[#249e83] transition-colors">
                        <span>{trip ? "Détails" : "Voir ma demande"}</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <BottomNav userRole={user?.role ?? "user"} />
    </div>
  );
}

export default function MyTripsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#f4f7fb]">
          <Loader2 className="h-6 w-6 animate-spin text-[#175276]" />
        </div>
      }
    >
      <TripsContent />
    </Suspense>
  );
}
