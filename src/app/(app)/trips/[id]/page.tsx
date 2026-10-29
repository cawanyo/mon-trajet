"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/navigation/BottomNav";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Car,
  MapPin,
  Users,
  Compass,
  ChevronLeft,
  Clock,
  Check,
  X,
  Phone,
  Loader2,
  AlertCircle,
  Trash2,
  Pencil,
  ChevronRight,
  MessageSquare,
  ShieldCheck,
  Navigation,
} from "lucide-react";
import { VerifiedTicker } from "@/components/ui/VerifiedTicker";
import { GpsChooserModal } from "@/components/navigation/GpsChooserModal";
import { getOptimalWaypointsOrder } from "@/lib/geo";
import { useToast } from "@/components/ui/ToastProvider";

function TripDetailsContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user, token } = useAuth();
  const { toast, confirm } = useToast();
  const tripId = params.id as Id<"trips">;

  const mapRef = useRef<any>(null);

  // Données du trajet et des demandes associées
  const trip = useQuery(api.trips.getTripDetails, {
    token: token || undefined,
    tripId,
  });

  const respondToRequest = useMutation(api.requests.respondToRequest);
  const updateTripStatus = useMutation(api.trips.updateTripStatus);
  const updateTripMutation = useMutation(api.trips.updateTrip);
  const cancelPassengerRequest = useMutation(api.requests.cancelPassengerRequest);

  // État passager vs conducteur
  const [showPassengerMap, setShowPassengerMap] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [isCancelling, setIsCancelling] = useState(false);
  const [showGpsChooser, setShowGpsChooser] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // TOUS LES HOOKS SONT DÉCLARÉS EN HAUT DE MANIÈRE INVARIANTE (RÈGLES DE HOOKS REACT)
  const isDriver = useMemo(() => {
    return Boolean(user?._id && trip?.driverId && user._id === trip.driverId);
  }, [user?._id, trip?.driverId]);

  const viewAs = searchParams.get("as");
  const isViewingAsPassenger = useMemo(() => {
    return !isDriver || viewAs === "passenger";
  }, [isDriver, viewAs]);

  const occupiedSeats = useMemo(() => {
    return (
      trip?.requests
        ?.filter((r) => r.status === "accepted" || r.status === "pending")
        .reduce((sum, r) => sum + r.seatsRequested, 0) ?? 0
    );
  }, [trip?.requests]);

  const pendingRequests = useMemo(() => {
    return trip?.requests?.filter((r) => r.status === "pending") ?? [];
  }, [trip?.requests]);

  const acceptedRequests = useMemo(() => {
    return trip?.requests?.filter((r) => r.status === "accepted") ?? [];
  }, [trip?.requests]);

  const optimalAcceptedWaypoints = useMemo(() => {
    if (!trip?.departureLocation || !trip?.destinationLocation || acceptedRequests.length === 0) {
      return acceptedRequests.map((r) => ({
        lat: r.pickupLocation.lat,
        lng: r.pickupLocation.lng,
        address: r.pickupLocation.address,
        name: r.passenger?.name || "Passager",
      }));
    }
    const escales = acceptedRequests.map((r) => ({
      ...r,
      pickupLocation: r.pickupLocation,
    }));
    const ordered = getOptimalWaypointsOrder(trip.departureLocation, trip.destinationLocation, escales);
    return ordered.map((r) => ({
      lat: r.pickupLocation.lat,
      lng: r.pickupLocation.lng,
      address: r.pickupLocation.address,
      name: r.passenger?.name || "Passager",
    }));
  }, [trip?.departureLocation, trip?.destinationLocation, acceptedRequests]);

  const passengerRequest = useMemo(() => {
    if (!trip?.requests) return null;
    const reqId = searchParams.get("requestId");
    if (reqId) {
      const match = trip.requests.find((r: any) => r._id === reqId);
      if (match) return match;
    }
    return trip.requests.find((r: any) => r.passengerId === user?._id) || null;
  }, [trip?.requests, searchParams, user?._id]);

  const requestStatus = passengerRequest?.status || "pending";

  const AUTO_CANCEL_THRESHOLD_MS = 45 * 60 * 1000;
  const isAutoCancelled = Boolean(
    trip &&
      trip.status === "planned" &&
      currentTime > trip.departureTime + AUTO_CANCEL_THRESHOLD_MS
  );
  const isTripCancelled = Boolean(trip && (trip.status === "cancelled" || isAutoCancelled));
  const isTripCompleted = Boolean(trip && trip.status === "completed");
  const isTripActive = Boolean(trip && !isTripCancelled && !isTripCompleted);

  const departureRelativeText = useMemo(() => {
    if (!trip?.departureTime) return "";
    if (trip.status === "cancelled" || (trip.status === "planned" && currentTime > trip.departureTime + AUTO_CANCEL_THRESHOLD_MS)) {
      return "Trajet annulé";
    }
    if (trip.status === "completed") {
      return "Trajet terminé";
    }
    if (trip.status === "active") {
      return "Trajet en cours";
    }
    const diffMs = trip.departureTime - currentTime;
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin > 0 && diffMin <= 60) {
      return `Départ dans ${diffMin} min`;
    }
    if (diffMin < 0 && diffMin >= -45) {
      return `Départ prévu il y a ${Math.abs(diffMin)} min`;
    }
    if (diffMin > 60 && diffMin <= 120) {
      const h = Math.floor(diffMin / 60);
      const m = diffMin % 60;
      return `Départ dans ${h}h${m > 0 ? m : ""}`;
    }
    const d = new Date(trip.departureTime);
    const isToday = new Date().toDateString() === d.toDateString();
    if (isToday) {
      return `Départ à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return `Départ ${d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }, [trip?.departureTime, trip?.status, currentTime]);

  // Onglet sélectionné pour le conducteur (1. Mon trajet, 2. Mes passagers, 3. Demandes)
  const [activeTab, setActiveTab] = useState<"details" | "passengers" | "requests">("details");

  // Modales & Fiche de demande détaillée
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Formulaire d'édition
  const [editDepartureTime, setEditDepartureTime] = useState("");
  const [editTotalSeats, setEditTotalSeats] = useState(3);
  const [editPickupRadius, setEditPickupRadius] = useState(500);
  const [editNotes, setEditNotes] = useState("");

  // État de la carte
  const [viewState, setViewState] = useState({
    latitude: 48.8566,
    longitude: 2.3522,
    zoom: 13,
  });

  // Ajustement de la carte pour afficher l'ensemble de l'itinéraire
  const fitRouteBounds = () => {
    if (!mapRef.current || !trip) return;
    const map = mapRef.current.getMap ? mapRef.current.getMap() : mapRef.current;
    if (!map) return;

    const minLng = Math.min(trip.departureLocation.lng, trip.destinationLocation.lng);
    const maxLng = Math.max(trip.departureLocation.lng, trip.destinationLocation.lng);
    const minLat = Math.min(trip.departureLocation.lat, trip.destinationLocation.lat);
    const maxLat = Math.max(trip.departureLocation.lat, trip.destinationLocation.lat);

    if (Math.abs(minLng - maxLng) < 0.0001 && Math.abs(minLat - maxLat) < 0.0001) {
      map.easeTo({
        center: [trip.departureLocation.lng, trip.departureLocation.lat],
        zoom: 14,
        duration: 800,
      });
      return;
    }

    try {
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        {
          padding: 55,
          duration: 900,
          maxZoom: 15.5,
        }
      );
    } catch (e) {
      console.warn("fitRouteBounds ignoré :", e);
    }
  };

  // Synchronisation des couches MapLibre (cercle de détour & ligne d'itinéraire)
  const syncMapLayers = () => {
    if (!mapRef.current || !trip) return;
    const map = mapRef.current.getMap ? mapRef.current.getMap() : mapRef.current;
    if (!map || typeof map.isStyleLoaded !== "function" || !map.isStyleLoaded()) return;

    try {
      // 1. Cercle de détour toléré
      if (trip.pickupRadiusMeters && trip.departureLocation) {
        const points = 64;
        const coords: [number, number][] = [];
        const km = trip.pickupRadiusMeters / 1000;
        const distanceX = km / (111.32 * Math.cos((trip.departureLocation.lat * Math.PI) / 180));
        const distanceY = km / 110.574;

        for (let i = 0; i < points; i++) {
          const theta = (i / points) * (2 * Math.PI);
          const x = distanceX * Math.cos(theta);
          const y = distanceY * Math.sin(theta);
          coords.push([trip.departureLocation.lng + x, trip.departureLocation.lat + y]);
        }
        coords.push(coords[0]);

        const circleGeoJSON = {
          type: "Feature" as const,
          geometry: {
            type: "Polygon" as const,
            coordinates: [coords],
          },
          properties: {},
        };

        const existingCircleSource = map.getSource("detour-circle-source");
        if (existingCircleSource) {
          (existingCircleSource as any).setData(circleGeoJSON);
        } else {
          map.addSource("detour-circle-source", {
            type: "geojson",
            data: circleGeoJSON,
          });

          if (!map.getLayer("detour-circle-fill")) {
            map.addLayer({
              id: "detour-circle-fill",
              type: "fill",
              source: "detour-circle-source",
              paint: {
                "fill-color": "#268d77",
                "fill-opacity": 0.16,
              },
            });
          }

          if (!map.getLayer("detour-circle-outline")) {
            map.addLayer({
              id: "detour-circle-outline",
              type: "line",
              source: "detour-circle-source",
              paint: {
                "line-color": "#138872",
                "line-width": 2,
                "line-dasharray": [3, 2],
              },
            });
          }
        }
      }

      // 2. Ligne reliant départ et destination
      const routeLineGeoJSON = {
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [trip.departureLocation.lng, trip.departureLocation.lat],
            [trip.destinationLocation.lng, trip.destinationLocation.lat],
          ],
        },
        properties: {},
      };

      const existingLineSource = map.getSource("route-line-source");
      if (existingLineSource) {
        (existingLineSource as any).setData(routeLineGeoJSON);
      } else {
        map.addSource("route-line-source", {
          type: "geojson",
          data: routeLineGeoJSON,
        });

        if (!map.getLayer("route-line-halo")) {
          map.addLayer({
            id: "route-line-halo",
            type: "line",
            source: "route-line-source",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#ffffff",
              "line-width": 6,
              "line-opacity": 0.9,
            },
          });
        }

        if (!map.getLayer("route-line-main")) {
          map.addLayer({
            id: "route-line-main",
            type: "line",
            source: "route-line-source",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#2669e2",
              "line-width": 4,
            },
          });
        }
      }
    } catch (e) {
      console.warn("Erreur synchronisation calques :", e);
    }
  };

  useEffect(() => {
    if (trip) {
      setViewState({
        latitude: (trip.departureLocation.lat + trip.destinationLocation.lat) / 2,
        longitude: (trip.departureLocation.lng + trip.destinationLocation.lng) / 2,
        zoom: 13,
      });
      syncMapLayers();
      setTimeout(fitRouteBounds, 250);
    }
  }, [trip]);

  // Formatage de l'heure
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Formatage de la date lisible
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  // Traitement d'une demande de passager (Accepter / Refuser)
  const handleRespond = async (requestId: Id<"requests">, decision: "accepted" | "rejected") => {
    if (!token) return;
    setIsActionLoading(true);
    try {
      await respondToRequest({
        token,
        requestId,
        decision,
      });
      toast.success(decision === "accepted" ? "Demande acceptée !" : "Demande refusée.");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du traitement");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Annulation du trajet par le conducteur
  const handleCancelTrip = async () => {
    if (!token || !trip) return;
    const ok = await confirm({
      title: "Annulation du trajet",
      message: "Êtes-vous sûr de vouloir annuler ce trajet ? Tous les passagers seront notifiés.",
      confirmText: "Oui, annuler",
      cancelText: "Conserver",
      destructive: true,
    });
    if (!ok) return;

    setIsActionLoading(true);
    try {
      await updateTripStatus({
        token,
        tripId: trip._id,
        status: "cancelled",
      });
      toast.success("Trajet annulé avec succès.");
      router.push("/trips");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'annulation");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Calcul de la distance à vol d'oiseau (km)
  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Formatage de l'ancienneté du membre
  const formatMembershipDuration = (createdAt?: number) => {
    if (!createdAt) return "Membre de l'église";
    const diffMs = Date.now() - createdAt;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffYears >= 1) {
      return `Membre de l'église • ${diffYears} an${diffYears > 1 ? "s" : ""}`;
    }
    if (diffMonths >= 1) {
      return `Membre de l'église • ${diffMonths} mois`;
    }
    return `Membre de l'église • Récent`;
  };

  // Format YYYY-MM-DDTHH:mm pour l'input datetime-local
  const toDateTimeLocal = (ts: number) => {
    const d = new Date(ts);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Ouverture du formulaire d'édition
  const handleOpenEdit = () => {
    if (!trip) return;
    setEditDepartureTime(toDateTimeLocal(trip.departureTime));
    setEditTotalSeats(Math.max(trip.totalSeats, occupiedSeats));
    setEditPickupRadius(trip.pickupRadiusMeters || 500);
    setEditNotes(trip.notes || "");
    setShowEditModal(true);
  };

  // Enregistrement des modifications du trajet
  const handleSaveEdit = async () => {
    if (!token || !trip) return;
    if (editTotalSeats < occupiedSeats) {
      toast.error(
        `Impossible : vous avez déjà accepté ${occupiedSeats} passager(s).`
      );
      return;
    }
    setIsActionLoading(true);
    try {
      const depTimestamp = new Date(editDepartureTime).getTime();
      if (isNaN(depTimestamp)) {
        toast.error("Date ou heure invalide.");
        return;
      }
      await updateTripMutation({
        token,
        tripId: trip._id,
        departureTime: depTimestamp,
        totalSeats: editTotalSeats,
        pickupRadiusMeters: editPickupRadius,
        notes: editNotes.trim() || undefined,
      });
      setShowEditModal(false);
      toast.success("Trajet mis à jour avec succès !");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la modification");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Gestion de l'appel au conducteur côté passager
  const handleCallDriver = () => {
    if (requestStatus === "accepted") {
      if (trip?.driver?.phoneNumber) {
        window.location.href = `tel:${trip.driver.phoneNumber}`;
      } else {
        toast.error("Numéro de téléphone du conducteur non renseigné.");
      }
    } else if (requestStatus === "pending") {
      toast.info("Le numéro sera accessible dès acceptation de votre demande.");
    } else {
      toast.error("Cette demande a été refusée par le conducteur.");
    }
  };

  // Annulation de la demande par le passager (libère les places chez le conducteur si elle était acceptée)
  const handleCancelPassengerRequest = async () => {
    if (!passengerRequest) {
      toast.error("Aucune demande trouvée pour ce trajet.");
      return;
    }
    const isAccepted = passengerRequest.status === "accepted";
    const ok = await confirm({
      title: "Annulation de réservation",
      message: isAccepted
        ? "Votre place est réservée. Confirmez-vous l'annulation ? Les places seront libérées."
        : "Confirmez-vous l'annulation de votre demande de trajet ?",
      confirmText: "Oui, annuler",
      cancelText: "Conserver",
      destructive: true,
    });

    if (!ok) return;

    setIsCancelling(true);
    try {
      await cancelPassengerRequest({
        token: token || undefined,
        requestId: passengerRequest._id,
      });
      toast.success("Votre demande a bien été annulée.");
      router.push("/trips?tab=passenger");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'annulation");
    } finally {
      setIsCancelling(false);
    }
  };

  // ========================================================
  // RENDU CONDITIONNEL (TOUS LES HOOKS ONT ÉTÉ APPELÉS CI-DESSUS)
  // ========================================================
  if (trip === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f4f7fb]">
        <Loader2 className="h-7 w-7 animate-spin text-[#2d6cb5]" />
      </div>
    );
  }

  if (trip === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#f4f7fb] p-6 text-center">
        <AlertCircle className="h-10 w-10 text-rose-500 mb-3" />
        <h1 className="text-lg font-bold text-slate-800">Trajet introuvable</h1>
        <p className="text-xs text-slate-500 mt-1 mb-4">Ce trajet n'existe plus ou a été supprimé.</p>
        <button
          onClick={() => router.push("/trips")}
          className="px-4 py-2 rounded-xl bg-[#2d6cb5] text-white text-xs font-bold"
        >
          Retour aux trajets
        </button>
      </div>
    );
  }

  // VUE PASSAGER : CONFORME À LA CAPTURE D'ÉCRAN
  if (isViewingAsPassenger) {
    return (
      <div className="relative min-h-dvh bg-[#f4f7fb] text-slate-800 pb-24 select-none overflow-x-hidden">
        {/* Halos d'ambiance glassy subtils */}
        <div className="pointer-events-none fixed -top-20 -right-20 h-80 w-80 rounded-full bg-teal-200/20 blur-3xl z-0" />
        <div className="pointer-events-none fixed top-1/3 -left-20 h-72 w-72 rounded-full bg-blue-100/30 blur-3xl z-0" />

        {/* 1. EN-TÊTE FIXE DU TEMPLATE : ← Mon trajet */}
        <div
          className="sticky top-0 z-30 glass-panel bg-white/85 backdrop-blur-2xl border-b border-white/80 px-4 pb-3 shadow-2xs"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))" }}
        >
          <div className="max-w-md mx-auto flex items-center gap-3">
            <button
              onClick={() => router.push("/trips?tab=passenger")}
              className="flex h-9 w-9 items-center justify-center rounded-2xl glass-card bg-white/90 text-[#1a3860] hover:bg-white active:scale-95 transition-all shadow-2xs border border-white/90"
              title="Retour à mes trajets"
            >
              <ChevronLeft className="h-5 w-5 stroke-[2.4]" />
            </button>
            <h1 className="text-base font-bold text-[#1a3860]">
              Mon trajet
            </h1>
          </div>
        </div>

        <div className="relative z-10 max-w-md mx-auto p-4 space-y-3.5">
          {/* LIGNE DE STATUT : BADGE (Validé / En attente / Rejeté / Annulé) + HEURE DE DÉPART */}
          <div className="flex items-center justify-between px-1">
            {requestStatus === "accepted" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#138872] text-white shadow-2xs">
                <Compass className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Validé</span>
              </span>
            ) : requestStatus === "pending" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-white shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                <span>En attente</span>
              </span>
            ) : requestStatus === "cancelled" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-400 text-white shadow-2xs">
                <X className="h-3 w-3 stroke-[3]" />
                <span>Annulé</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500 text-white shadow-2xs">
                <X className="h-3 w-3 stroke-[3]" />
                <span>Rejeté</span>
              </span>
            )}

            <span className="text-xs font-semibold text-[#1a3860]">
              {departureRelativeText}
            </span>
          </div>

          {/* CARTE BLANCHE ROUNDED CONFORME AU TEMPLATE */}
          <div className="rounded-3xl glass-card bg-white p-5 border border-slate-100 shadow-sm space-y-4">
            {/* Ligne Conducteur & Véhicule */}
            <div className="flex items-center gap-3.5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 ring-2 ring-white shadow-xs overflow-hidden flex-shrink-0">
                {trip.driver?.avatarUrl ? (
                  <img
                    src={trip.driver.avatarUrl}
                    alt={trip.driver.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-black text-[#175276]">
                    {trip.driver?.name?.charAt(0) || "C"}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold text-[#1a3860] truncate">
                    {trip.driver?.name || "Conducteur"}
                  </span>
                  <VerifiedTicker status={trip.driver?.status} />
                </div>
                <p className="text-xs text-[#7d8fa5] mt-0.5">
                  ⭐ 4,8 • Conducteur
                </p>
                <div className="flex items-center gap-1.5 text-xs text-[#7d8fa5] mt-1">
                  <Car className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                  <span className="truncate">Toyota Corolla • Blanc</span>
                </div>
              </div>
            </div>

            {/* Séparateur */}
            <div className="border-t border-slate-100" />

            {/* Itinéraire : Lieu de prise en charge -> Destination */}
            <div className="space-y-2">
              {/* Lieu de prise en charge */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-700 flex-shrink-0">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[#1a3860] block truncate">
                    {passengerRequest?.pickupLocation?.address || trip.departureLocation.address}
                  </span>
                  <span className="text-[11px] text-[#7d8fa5] block mt-0.5">
                    Lieu de prise en charge
                  </span>
                </div>
              </div>

              {/* Ligne pointillée */}
              <div className="ml-3.5 w-0.5 h-5 border-l-2 border-dashed border-slate-300" />

              {/* Destination */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 text-[#138872] flex-shrink-0">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[#1a3860] block truncate">
                    {passengerRequest?.destinationLocation?.address || trip.destinationLocation.address}
                  </span>
                  <span className="text-[11px] text-[#7d8fa5] block mt-0.5">
                    Destination
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CARTE INTERACTIVE COLLAPSIBLE SI DEMANDÉE */}
          {showPassengerMap && (
            <div className="rounded-3xl overflow-hidden shadow-sm border border-slate-200 h-52 relative animate-in fade-in duration-200">
              <Map
                initialViewState={{
                  latitude: trip.departureLocation.lat,
                  longitude: trip.departureLocation.lng,
                  zoom: 13,
                }}
                mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
              >
                <Marker
                  latitude={trip.departureLocation.lat}
                  longitude={trip.departureLocation.lng}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#138872] text-white shadow-md ring-2 ring-white">
                    <Car className="h-3.5 w-3.5" />
                  </div>
                </Marker>
                <Marker
                  latitude={trip.destinationLocation.lat}
                  longitude={trip.destinationLocation.lng}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2669e2] text-white shadow-md ring-2 ring-white">
                    <MapPin className="h-3.5 w-3.5" />
                  </div>
                </Marker>
              </Map>
            </div>
          )}

          {/* BOUTONS D'ACTION DU TEMPLATE */}
          <div className="space-y-2.5 pt-1">
            {/* 1. Bouton : Voir le trajet sur la carte */}
            <button
              type="button"
              onClick={() => setShowPassengerMap((v) => !v)}
              className="w-full py-3.5 rounded-full border border-blue-200/90 bg-white hover:bg-blue-50/50 text-[#175276] text-xs font-bold transition-all shadow-2xs active:scale-[0.98]"
            >
              {showPassengerMap ? "Masquer la carte" : "Voir le trajet sur la carte"}
            </button>

            {/* 2. Bouton : Contacter le conducteur */}
            <button
              type="button"
              onClick={handleCallDriver}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#175276] via-[#154665] to-[#0f354c] hover:from-[#134260] hover:to-[#0a2536] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-[#175276]/20 active:scale-[0.98] transition-all"
            >
              <Phone className="h-4 w-4 fill-white" />
              <span>Contacter le conducteur</span>
            </button>

            {/* 3. Bouton : Annuler ma demande / réservation */}
            {passengerRequest && requestStatus !== "cancelled" && (
              <button
                type="button"
                onClick={handleCancelPassengerRequest}
                disabled={isCancelling}
                className="w-full py-3.5 rounded-full border border-rose-200/90 bg-white hover:bg-rose-50/70 text-rose-600 text-xs font-bold transition-all shadow-2xs active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isCancelling ? (
                  <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
                ) : (
                  <X className="h-4 w-4 stroke-[2.5]" />
                )}
                <span>
                  {requestStatus === "accepted"
                    ? "Annuler ma réservation"
                    : "Annuler ma demande"}
                </span>
              </button>
            )}
          </div>

          {/* CARTE DE RASSURANCE BASSE */}
          <div className="rounded-2xl bg-[#eef8f5] border border-[#ccefe4] p-4 flex items-center gap-3.5 shadow-2xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#138872] shadow-xs flex-shrink-0 border border-[#b2e5d7]">
              <ShieldCheck className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#1a3860]">
                Merci d'être à l'heure !
              </h3>
              <p className="text-[11px] font-medium text-[#138872] mt-0.5">
                Ensemble, c'est plus simple.
              </p>
            </div>
          </div>
        </div>

        {/* Barre de navigation inférieure */}
        <BottomNav userRole={user?.role ?? "user"} />

        {/* Modale GPS Passager (Google Maps / Waze / Apple Plans) */}
        {trip && (
          <GpsChooserModal
            isOpen={showGpsChooser}
            onClose={() => setShowGpsChooser(false)}
            origin={passengerRequest?.pickupLocation || trip.departureLocation}
            destination={trip.destinationLocation}
            waypoints={[]}
            tripId={trip._id}
            onOpenInApp={() => {
              router.push("/");
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative h-dvh max-h-dvh bg-[#f4f7fb] text-slate-800 flex flex-col select-none overflow-hidden">
      {/* Halos d'ambiance pour accentuer l'effet de réfraction du verre dépoli */}
      <div className="pointer-events-none fixed -top-20 -right-20 h-80 w-80 rounded-full bg-blue-200/35 blur-3xl z-10" />
      <div className="pointer-events-none fixed top-1/2 -left-20 h-72 w-72 rounded-full bg-teal-100/35 blur-3xl z-10" />

      {/* BOUTON RETOUR (<) FIXE EN HAUT À GAUCHE (RESPECT DE LA SAFE AREA) */}
      <button
        onClick={() => router.push("/trips")}
        className="fixed left-4 z-30 flex h-11 w-11 items-center justify-center rounded-full glass-card bg-white/90 backdrop-blur-xl text-slate-700 shadow-md border border-white/90 hover:bg-white active:scale-95 transition-all"
        style={{ top: "max(1rem, env(safe-area-inset-top, 1rem))" }}
        title="Retour"
      >
        <ChevronLeft className="h-6 w-6 stroke-[2.4]" />
      </button>

      {/* 1. SECTION SUPÉRIEURE : CARTE INTERACTIVE FIXE */}
      <div className="relative h-[38dvh] sm:h-[44dvh] min-h-[220px] w-full bg-slate-100 overflow-hidden flex-shrink-0">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          onLoad={() => {
            setTimeout(() => {
              syncMapLayers();
              fitRouteBounds();
            }, 100);
          }}
          onIdle={syncMapLayers}
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
          style={{ width: "100%", height: "100%" }}
          attributionControl={false}
        >
          <NavigationControl position="top-right" />

          {/* Marqueur Départ (Pin bleu #2669e2 avec icône voiture) */}
          <Marker
            latitude={trip.departureLocation.lat}
            longitude={trip.departureLocation.lng}
            anchor="bottom"
          >
            <div className="relative flex flex-col items-center group">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2669e2] text-white shadow-xl ring-3 ring-white">
                <Car className="h-5 w-5 stroke-[2.2]" />
              </div>
              <div className="h-2.5 w-2.5 rotate-45 bg-[#2669e2] -mt-1 ring-1 ring-white" />
            </div>
          </Marker>

          {/* Marqueur Destination (Pin bleu #2669e2 avec icône destination) */}
          <Marker
            latitude={trip.destinationLocation.lat}
            longitude={trip.destinationLocation.lng}
            anchor="bottom"
          >
            <div className="relative flex flex-col items-center group">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2669e2] text-white shadow-xl ring-3 ring-white">
                <MapPin className="h-5 w-5 stroke-[2.2]" />
              </div>
              <div className="h-2.5 w-2.5 rotate-45 bg-[#2669e2] -mt-1 ring-1 ring-white" />
            </div>
          </Marker>
        </Map>

        {/* Bouton circulaire recentrer (cible) en bas à droite au-dessus de la carte */}
        <button
          onClick={fitRouteBounds}
          className="absolute bottom-8 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full glass-card bg-white/90 backdrop-blur-xl text-[#1a3860] shadow-lg border border-white/90 hover:bg-white active:scale-95 transition-all"
          title="Centrer l'itinéraire"
        >
          <Compass className="h-5 w-5 stroke-[2.2] text-[#1a3860]" />
        </button>
      </div>

      {/* 2. SECTION INFÉRIEURE : FEUILLE "MON TRAJET" AVEC DÉFILEMENT INTERNE */}
      <div className="relative -mt-5 z-20 flex-1 min-h-0 rounded-t-[32px] sm:rounded-t-[36px] glass-panel bg-white/95 backdrop-blur-2xl border-t border-white/90 shadow-[0_-16px_40px_rgba(15,35,60,0.08)] flex flex-col overflow-hidden">
        {/* EN-TÊTE FIXE DE LA FEUILLE : POIGNÉE + 3 ONGLETS */}
        <div className="px-5 pt-2.5 pb-2 flex-shrink-0">
          {/* Poignée de glissement supérieure */}
          <div className="h-1.5 w-11 rounded-full bg-slate-300/80 mx-auto mb-2.5" />

          {/* LIGNE DES 3 OPTIONS : 1. Mon trajet | 2. Mes passagers | 3. Demandes */}
          <div className="flex items-center rounded-2xl bg-slate-100/90 p-1 border border-white/60">
            {/* 1. Mon trajet (par défaut) */}
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`flex-1 py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${
                activeTab === "details"
                  ? "bg-white text-[#1a3860] shadow-sm"
                  : "text-[#6e8298] hover:text-[#1a3860]"
              }`}
            >
              Mon trajet
            </button>

            {/* 2. Mes passagers (acceptés) */}
            <button
              type="button"
              onClick={() => setActiveTab("passengers")}
              className={`flex-1 py-2 px-1 text-center rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "passengers"
                  ? "bg-white text-[#1a3860] shadow-sm"
                  : "text-[#6e8298] hover:text-[#1a3860]"
              }`}
            >
              <span>Mes passagers</span>
              {acceptedRequests.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    activeTab === "passengers"
                      ? "bg-[#138872] text-white"
                      : "bg-emerald-100 text-[#138872]"
                  }`}
                >
                  {acceptedRequests.length}
                </span>
              )}
            </button>

            {/* 3. Demandes (en attente) */}
            <button
              type="button"
              onClick={() => setActiveTab("requests")}
              className={`flex-1 py-2 px-1 text-center rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "requests"
                  ? "bg-white text-[#1a3860] shadow-sm"
                  : "text-[#6e8298] hover:text-[#1a3860]"
              }`}
            >
              <span>Demandes</span>
              {pendingRequests.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    activeTab === "requests"
                      ? "bg-amber-500 text-white"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {pendingRequests.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* CONTENU DE L'ONGLET SÉLECTIONNÉ : SCROLLABLE */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-1 space-y-3">
            {/* ONGLET 1 : DÉTAILS DU TRAJET */}
            {activeTab === "details" && (
              <div className="space-y-3">
                {/* Carte Itinéraire avec léger fond vitré translucide */}
                <div className="p-3.5 rounded-2xl glass-card bg-white/70 border border-white/80 space-y-2 shadow-xs">
                  {/* Départ */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-50/90 text-[#2d6cb5] flex-shrink-0">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-[#1a3860] truncate">
                        {trip.departureLocation.address}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#2d6cb5] bg-blue-50/80 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {formatTime(trip.departureTime)}
                    </span>
                  </div>

                  {/* Ligne pointillée verticale */}
                  <div className="ml-3.5 my-0.5 w-0.5 h-4 border-l-2 border-dashed border-slate-300" />

                  {/* Destination */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-50/90 text-[#38917d] flex-shrink-0">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-[#1a3860] truncate">
                      {trip.destinationLocation.address}
                    </span>
                  </div>
                </div>

                {/* Places disponibles & Statut */}
                <div className="flex items-center justify-between p-3 rounded-2xl glass-card bg-white/70 border border-white/80 shadow-xs">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#1a3860]">
                    <Users className="h-4.5 w-4.5 text-[#1a3860]" />
                    <span>
                      {trip.availableSeats} {trip.availableSeats > 1 ? "places disponibles" : "place disponible"} sur {trip.totalSeats}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold shadow-xs ${
                      isTripCancelled
                        ? "bg-rose-50 text-rose-600 border border-rose-200"
                        : isTripCompleted
                        ? "bg-slate-100 text-slate-600 border border-slate-200"
                        : trip.status === "active"
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "bg-[#e6f4f0]/90 text-[#138872] border border-[#cce8e0]/80"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isTripCancelled
                          ? "bg-rose-500"
                          : isTripCompleted
                          ? "bg-slate-400"
                          : trip.status === "active"
                          ? "bg-blue-500 animate-pulse"
                          : "bg-[#138872]"
                      }`}
                    />
                    <span>
                      {isTripCancelled
                        ? "Annulé"
                        : isTripCompleted
                        ? "Passé"
                        : trip.status === "active"
                        ? "En cours"
                        : trip.availableSeats > 0
                        ? "Disponible"
                        : "Complet"}
                    </span>
                  </span>
                </div>

                {/* Détails complémentaires : Date et Détour toléré */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-2xl glass-card bg-white/70 border border-white/80">
                    <span className="text-[10px] font-semibold text-slate-400 block">Date</span>
                    <span className="font-bold text-[#1a3860] truncate block">
                      {formatDate(trip.departureTime)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl glass-card bg-white/70 border border-white/80">
                    <span className="text-[10px] font-semibold text-slate-400 block">Détour toléré</span>
                    <span className="font-bold text-[#1a3860] block">
                      {trip.pickupRadiusMeters
                        ? trip.pickupRadiusMeters >= 1000
                          ? `${(trip.pickupRadiusMeters / 1000).toFixed(1)} km`
                          : `${trip.pickupRadiusMeters} m`
                        : "500 m"}
                    </span>
                  </div>
                </div>

                {/* Note du conducteur si présente */}
                {trip.notes && (
                  <div className="p-3 rounded-2xl glass-card bg-white/70 border border-white/80 text-xs">
                    <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">Note</span>
                    <p className="text-slate-700 italic">"{trip.notes}"</p>
                  </div>
                )}
              </div>
            )}

            {/* ONGLET 2 : MES PASSAGERS (DEMANDES DÉJÀ ACCEPTÉES) */}
            {activeTab === "passengers" && (
              <div className="space-y-2.5">
                {acceptedRequests.length === 0 ? (
                  <div className="py-8 px-4 text-center rounded-2xl glass-card bg-white/70 border border-white/80 space-y-2">
                    <Users className="h-7 w-7 mx-auto text-slate-300" />
                    <p className="text-xs font-bold text-[#1a3860]">
                      Aucun passager accepté pour le moment
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Les passagers acceptés s'afficheront ici avec leur contact direct.
                    </p>
                  </div>
                ) : (
                  acceptedRequests.map((req) => (
                    <div
                      key={req._id}
                      className="p-3.5 rounded-2xl glass-card bg-white/80 border border-white/90 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Infos Passager */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm flex-shrink-0">
                            {req.passenger?.name?.charAt(0) || "P"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs sm:text-sm font-bold text-[#1a3860] truncate">
                                {req.passenger?.name || "Passager"}
                              </span>
                              <VerifiedTicker status={req.passenger?.status} />
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                {req.seatsRequested}{" "}
                                {req.seatsRequested > 1 ? "places" : "place"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* BOUTON D'APPEL DIRECTEMENT À CÔTÉ */}
                        {req.passenger?.phoneNumber ? (
                          <a
                            href={`tel:${req.passenger.phoneNumber}`}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex-shrink-0"
                            title={`Appeler ${req.passenger.name}`}
                          >
                            <Phone className="h-3.5 w-3.5 fill-white" />
                            <span>Appeler</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Pas de n°</span>
                        )}
                      </div>

                      {/* Adresse de prise en charge */}
                      {req.pickupLocation?.address && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                          <MapPin className="h-3.5 w-3.5 text-teal-600 flex-shrink-0" />
                          <span className="truncate">
                            Prise en charge : {req.pickupLocation.address}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ONGLET 3 : DEMANDES (DEMANDES EN ATTENTE) */}
            {activeTab === "requests" && (
              <div className="space-y-2.5">
                {pendingRequests.length === 0 ? (
                  <div className="py-8 px-4 text-center rounded-2xl glass-card bg-white/70 border border-white/80 space-y-2">
                    <Users className="h-7 w-7 mx-auto text-slate-300" />
                    <p className="text-xs font-bold text-[#1a3860]">
                      Aucune demande en attente
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Vous recevrez une alerte dès qu'un passager souhaite rejoindre votre trajet.
                    </p>
                  </div>
                ) : (
                  pendingRequests.map((req) => (
                    <div
                      key={req._id}
                      className="p-3.5 rounded-2xl glass-card bg-white/80 hover:bg-white border border-white/90 shadow-xs space-y-2.5 transition-all"
                    >
                      {/* En-tête cliquable pour voir les détails de la demande */}
                      <div
                        onClick={() => setSelectedRequest(req)}
                        className="flex items-center justify-between gap-2 cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-[#175276] font-bold text-sm flex-shrink-0">
                            {req.passenger?.name?.charAt(0) || "P"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs sm:text-sm font-bold text-[#1a3860] group-hover:text-blue-600 transition-colors truncate">
                                {req.passenger?.name || "Passager"}
                              </span>
                              <VerifiedTicker status={req.passenger?.status} />
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {req.seatsRequested}{" "}
                              {req.seatsRequested > 1 ? "places demandées" : "place demandée"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-xs text-blue-600 font-bold group-hover:underline flex-shrink-0">
                          <span>Voir la demande</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </div>
                      </div>

                      {req.pickupLocation?.address && (
                        <div
                          onClick={() => setSelectedRequest(req)}
                          className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50/80 p-2 rounded-xl cursor-pointer hover:bg-slate-100/80 transition-colors"
                        >
                          <MapPin className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                          <span className="truncate">
                            Lieu souhaité : {req.pickupLocation.address}
                          </span>
                        </div>
                      )}

                      {/* Boutons d'action directe : Accepter & Refuser */}
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRespond(req._id, "accepted");
                          }}
                          disabled={isActionLoading}
                          className="flex-1 py-2 rounded-xl bg-[#138872] hover:bg-[#0f6c5b] text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all shadow-xs"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Accepter</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRespond(req._id, "rejected");
                          }}
                          disabled={isActionLoading}
                          className="flex-1 py-2 rounded-xl glass-card bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Refuser</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

        {/* BOUTONS D'ACTION INFÉRIEURS FIXES */}
        <div
          className="px-5 pt-2 pb-3 bg-white/95 border-t border-slate-100/90 flex-shrink-0 space-y-2 shadow-2xs"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}
        >
          {/* BOUTON PRINCIPAL DE NAVIGATION GPS (APPROCHE HYBRIDE : GOOGLE MAPS / WAZE / APPLE PLANS) */}
          {!isTripCancelled && !isTripCompleted && (
            <button
              onClick={() => setShowGpsChooser(true)}
              className="w-full h-11 sm:h-12 rounded-2xl bg-gradient-to-r from-[#2d6cb5] to-[#138872] hover:opacity-95 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#2d6cb5]/25 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Navigation className="h-4 w-4 fill-white" />
              <span>Y aller (Lancer le GPS)</span>
            </button>
          )}

          {/* BOUTONS D'ACTION INFÉRIEURS : MODIFIER & ANNULER */}
          <div className="grid grid-cols-2 gap-3">
            {/* Bouton Modifier */}
            <button
              onClick={handleOpenEdit}
              disabled={isTripCancelled || isTripCompleted}
              className="h-11 rounded-2xl bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-[#1b7f80]/20 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Pencil className="h-4 w-4" />
              <span>Modifier</span>
            </button>

            {/* Bouton Annuler */}
            <button
              onClick={handleCancelTrip}
              disabled={isActionLoading || isTripCancelled || isTripCompleted}
              className="h-11 rounded-2xl glass-card bg-rose-50/80 hover:bg-rose-100 text-rose-600 border border-rose-200/70 text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
            >
              <Trash2 className="h-4 w-4" />
              <span>Annuler</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODALE GLASSY : DÉTAIL D'UNE DEMANDE (STYLE DE LA CAPTURE)    */}
      {/* ============================================================ */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-t-[36px] sm:rounded-3xl glass-panel bg-white/95 backdrop-blur-2xl border border-white/90 px-6 pt-0 pb-6 shadow-2xl">
            {/* Bouton fermer (X) en haut à droite */}
            <button
              onClick={() => setSelectedRequest(null)}
              className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full glass-card bg-white/80 text-slate-500 hover:text-slate-800 hover:bg-white transition-colors"
            >
              <X className="h-4 w-4 stroke-[2.5]" />
            </button>

            {/* Photo de profil circulaire en saillie au-dessus de la carte */}
            <div className="relative -top-10 mx-auto flex flex-col items-center">
              <div className="h-20 w-20 rounded-full overflow-hidden ring-4 ring-white shadow-xl bg-slate-100 flex items-center justify-center">
                {selectedRequest.passenger?.avatarUrl ? (
                  <img
                    src={selectedRequest.passenger.avatarUrl}
                    alt={selectedRequest.passenger.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-[#175276] to-[#249e83] text-white font-black text-2xl">
                    {selectedRequest.passenger?.name?.charAt(0) || "P"}
                  </div>
                )}
              </div>
            </div>

            {/* Nom & Ancienneté du membre */}
            <div className="-mt-6 text-center space-y-0.5 mb-4">
              <h2 className="text-xl font-black text-[#1a3860] tracking-tight">
                {selectedRequest.passenger?.name || "Passager"}
              </h2>
              <p className="text-xs font-medium text-[#7d8fa5]">
                {formatMembershipDuration(selectedRequest.passenger?.createdAt)}
              </p>
            </div>

            {/* Carte des détails (Prise en charge, Destination, Places, Message) */}
            <div className="rounded-3xl bg-[#f8fafc]/90 border border-slate-100/90 p-4 space-y-4 mb-4 shadow-xs">
              {/* 1. Prise en charge */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50/90 text-[#1a3860] flex-shrink-0">
                  <MapPin className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-[#7d8fa5] block uppercase tracking-wider">
                    Prise en charge
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-[#1a3860] mt-0.5">
                    {selectedRequest.pickupLocation?.address || "Lieu indiqué par le passager"}
                  </p>
                  {selectedRequest.pickupLocation && trip.departureLocation && (
                    <p className="text-[11px] font-medium text-[#7d8fa5] mt-0.5">
                      À {getDistanceKm(
                        selectedRequest.pickupLocation.lat,
                        selectedRequest.pickupLocation.lng,
                        trip.departureLocation.lat,
                        trip.departureLocation.lng
                      ).toFixed(1).replace(".", ",")}{" "}
                      km de votre itinéraire
                    </p>
                  )}
                </div>
              </div>

              {/* 2. Destination */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50/90 text-[#1a3860] flex-shrink-0">
                  <MapPin className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-[#7d8fa5] block uppercase tracking-wider">
                    Destination
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-[#1a3860] mt-0.5">
                    {trip.destinationLocation.address}
                  </p>
                  <p className="text-[11px] font-medium text-[#7d8fa5] mt-0.5">
                    Arrivée à {formatTime(trip.departureTime)}
                  </p>
                </div>
              </div>

              {/* 3. Places demandées */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50/90 text-[#1a3860] flex-shrink-0">
                  <Users className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-[#7d8fa5] block uppercase tracking-wider">
                    Places demandées
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-[#1a3860] mt-0.5">
                    {selectedRequest.seatsRequested}{" "}
                    {selectedRequest.seatsRequested > 1 ? "places" : "place"}
                  </p>
                </div>
              </div>

              {/* 4. Message si présent */}
              {selectedRequest.note && (
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50/90 text-[#1a3860] flex-shrink-0">
                    <MessageSquare className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold text-[#7d8fa5] block uppercase tracking-wider">
                      Message
                    </span>
                    <p className="text-xs font-semibold text-[#1a3860] mt-0.5 italic">
                      "{selectedRequest.note}"
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Boutons d'action : Accepter / Refuser */}
            <div className="space-y-2.5 pt-1">
              <button
                onClick={async () => {
                  await handleRespond(selectedRequest._id, "accepted");
                  setSelectedRequest(null);
                }}
                disabled={isActionLoading}
                className="w-full h-13 rounded-2xl bg-gradient-to-r from-[#1ea27c] via-[#24b087] to-[#2ecc9b] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#1ea27c]/25 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isActionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span>Accepter</span>
                )}
              </button>

              <button
                onClick={async () => {
                  await handleRespond(selectedRequest._id, "rejected");
                  setSelectedRequest(null);
                }}
                disabled={isActionLoading}
                className="w-full h-13 rounded-2xl bg-slate-100 hover:bg-slate-200 text-[#1a3860] text-sm font-bold flex items-center justify-center transition-all border border-slate-200/60 active:scale-[0.98]"
              >
                <span>Refuser</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODALE BOTTOM SHEET ÉPURÉE : MODIFIER LE TRAJET              */}
      {/* ============================================================ */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-t-[32px] sm:rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 space-y-4 max-h-[85vh] overflow-y-auto">
            {/* Poignée mobile */}
            <div className="h-1 w-9 bg-slate-200 rounded-full mx-auto -mt-1 sm:hidden" />

            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-sm font-black text-[#1a3860]">
                Modifier le trajet
              </h2>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEdit();
              }}
              className="space-y-3.5 text-xs"
            >
              {/* Date & Heure */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#138872]" />
                  <span>Date et heure de départ</span>
                </label>
                <input
                  type="datetime-local"
                  value={editDepartureTime}
                  onChange={(e) => setEditDepartureTime(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-bold text-slate-800 focus:bg-white focus:border-[#138872] focus:outline-none transition-all"
                  required
                />
              </div>

              {/* Stepper Places */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-[#138872]" />
                    <span>Places disponibles</span>
                  </label>
                  {occupiedSeats > 0 && (
                    <span className="text-[10px] font-semibold text-slate-400">
                      Min. {occupiedSeats} réservée{occupiedSeats > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-1.5 border border-slate-200/80">
                  <button
                    type="button"
                    disabled={editTotalSeats <= Math.max(1, occupiedSeats)}
                    onClick={() =>
                      setEditTotalSeats((s) => Math.max(Math.max(1, occupiedSeats), s - 1))
                    }
                    className="h-8 w-8 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-2xs"
                  >
                    -
                  </button>
                  <span className="font-bold text-sm text-[#1a3860]">
                    {editTotalSeats} place{editTotalSeats > 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    disabled={editTotalSeats >= 8}
                    onClick={() => setEditTotalSeats((s) => Math.min(8, s + 1))}
                    className="h-8 w-8 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-2xs"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Détour toléré */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5 text-[#138872]" />
                    <span>Détour toléré</span>
                  </label>
                  <span className="font-bold text-[#138872]">
                    {editPickupRadius >= 1000
                      ? `${(editPickupRadius / 1000).toFixed(1)} km`
                      : `${editPickupRadius} m`}
                  </span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="5000"
                  step="100"
                  value={editPickupRadius}
                  onChange={(e) => setEditPickupRadius(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#138872]"
                />
              </div>

              {/* Instructions / Remarques */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Instructions ou remarques
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Ex: Coffre spacieux, départ ponctuel..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#138872] focus:outline-none transition-all"
                />
              </div>

              {/* Bouton de sauvegarde sobre */}
              <button
                type="submit"
                disabled={isActionLoading}
                className="w-full h-11 rounded-2xl bg-[#175276] hover:bg-[#134260] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 mt-1"
              >
                {isActionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>Enregistrer</span>
              </button>
            </form>
          </div>
        </div>
      )}
      {/* MODALE DE NAVIGATION GPS CONDUCTEUR (APPROCHE HYBRIDE : GOOGLE MAPS / WAZE / APPLE PLANS) */}
      {trip && (
        <GpsChooserModal
          isOpen={showGpsChooser}
          onClose={() => setShowGpsChooser(false)}
          origin={trip.departureLocation}
          destination={trip.destinationLocation}
          waypoints={optimalAcceptedWaypoints}
          tripId={trip._id}
          onOpenInApp={async () => {
            if (isDriver && trip.status === "planned") {
              const diffMs = trip.departureTime - Date.now();
              if (diffMs < -45 * 60 * 1000) {
                toast.error("Le délai de 45 minutes est dépassé. Ce trajet est considéré comme annulé.");
                return;
              }
              let shouldStart = true;
              if (diffMs > 15 * 60 * 1000) {
                const min = Math.round(diffMs / 60000);
                shouldStart = await confirm({
                  title: "Démarrage anticipé du trajet",
                  message: `Le départ est prévu dans ${min} minutes. Souhaitez-vous démarrer le trajet dès maintenant pour vos passagers ?`,
                  confirmText: "Oui, démarrer",
                  cancelText: "Ouvrir le GPS seulement",
                });
              }
              if (shouldStart) {
                try {
                  await updateTripStatus({
                    token: token || undefined,
                    tripId: trip._id,
                    status: "active",
                  });
                  toast.success("Trajet démarré !");
                } catch (e) {
                  console.warn("Erreur mise à jour statut actif :", e);
                }
              }
            }
            // Retour sur l'accueil demandé par l'utilisateur
            router.push("/");
          }}
        />
      )}
    </div>
  );
}

export default function TripDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#f4f7fb]">
          <Loader2 className="h-7 w-7 animate-spin text-[#2d6cb5]" />
        </div>
      }
    >
      <TripDetailsContent />
    </Suspense>
  );
}
