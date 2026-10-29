"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/navigation/BottomNav";
import { AddressAutocompleteInput } from "@/components/ui/AddressAutocompleteInput";
import { VerifiedTicker } from "@/components/ui/VerifiedTicker";
import { reverseGeocode, getDistanceMeters, formatDistance } from "@/lib/geo";
import { useToast } from "@/components/ui/ToastProvider";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ChevronLeft,
  MapPin,
  Clock,
  Calendar,
  Check,
  X,
  Loader2,
  Users,
  AlertCircle,
  Pencil,
  Sparkles,
  Phone,
  Navigation,
  Car,
  ArrowRight,
  Heart,
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

// Extraction des heures si la note contient "Créneau : 08h - 12h"
function parseTimeSlotFromNote(note?: string) {
  if (!note) return { startHour: 5, endHour: 24, cleanNote: "", hasSlot: false };
  const match = note.match(/Créneau\s*:\s*(\d+)h\s*-\s*(\d+)h/i);
  if (match) {
    const startHour = parseInt(match[1], 10);
    const endHour = parseInt(match[2], 10);
    const cleanNote = note.replace(/\(?\s*Créneau\s*:\s*\d+h\s*-\s*\d+h\s*\)?/i, "").trim();
    return { startHour, endHour, cleanNote, hasSlot: true };
  }
  return { startHour: 5, endHour: 24, cleanNote: note, hasSlot: false };
}

const START_HOURS = Array.from({ length: 24 }, (_, i) => i);
const END_HOURS = Array.from({ length: 24 }, (_, i) => i + 1);
const formatHourLabel = (h: number) => `${String(h).padStart(2, "0")}h`;

function RequestDetailsContent() {
  const router = useRouter();
  const params = useParams();
  const { user, token } = useAuth();
  const { toast, confirm } = useToast();
  const requestId = params.id as Id<"requests">;
  const mapRef = useRef<any>(null);

  // Données de la demande
  const request = useQuery(
    api.requests.getRequestDetails,
    requestId ? { requestId, token: token || undefined } : "skip"
  );

  const isOwner = Boolean(request?.isOwner);

  const cancelPassengerRequest = useMutation(api.requests.cancelPassengerRequest);
  const updateRequestMutation = useMutation(api.requests.updateRequest);
  const proposePickUpAndCreateTrip = useMutation(api.requests.proposePickUpAndCreateTrip);
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);

  // État temps réel pour la mention "Ajoutée il y a..."
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const parsedSlot = useMemo(() => {
    return parseTimeSlotFromNote(request?.note);
  }, [request?.note]);

  // 1. Position du visualiseur (utilisateur connecté) pour calcul de distance et carte
  const [viewerLocation, setViewerLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (user?.homeAddress?.lat && user?.homeAddress?.lng) {
      setViewerLocation({
        lat: user.homeAddress.lat,
        lng: user.homeAddress.lng,
      });
    }

    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setViewerLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [user]);

  // 2. Résolution automatique d'une vraie adresse postale (évite "Ma position GPS" ou coordonnées brutes)
  const [resolvedPickupAddress, setResolvedPickupAddress] = useState("");
  const [resolvedDestAddress, setResolvedDestAddress] = useState("");

  useEffect(() => {
    if (!request) return;

    const rawPickup = request.pickupLocation?.address || "";
    if (
      !rawPickup ||
      rawPickup.toLowerCase().includes("position") ||
      rawPickup.toLowerCase().includes("gps") ||
      rawPickup.toLowerCase().includes("secteur")
    ) {
      reverseGeocode(request.pickupLocation.lat, request.pickupLocation.lng).then((realAddr) => {
        if (realAddr) setResolvedPickupAddress(realAddr);
      });
    } else {
      setResolvedPickupAddress(rawPickup);
    }

    const rawDest = request.destinationLocation?.address || "";
    if (rawDest && (rawDest.toLowerCase().includes("position") || rawDest.toLowerCase().includes("gps"))) {
      if (request.destinationLocation?.lat && request.destinationLocation?.lng) {
        reverseGeocode(request.destinationLocation.lat, request.destinationLocation.lng).then((realAddr) => {
          if (realAddr) setResolvedDestAddress(realAddr);
        });
      }
    } else {
      setResolvedDestAddress(rawDest || "Église (Centre-ville)");
    }
  }, [request]);

  // 3. Calcul de distance exacte entre le visualiseur et le lieu de prise en charge
  const distanceInfo = useMemo(() => {
    if (!viewerLocation || !request?.pickupLocation) return null;
    const meters = getDistanceMeters(
      viewerLocation.lat,
      viewerLocation.lng,
      request.pickupLocation.lat,
      request.pickupLocation.lng
    );
    return {
      meters,
      formatted: formatDistance(meters),
    };
  }, [viewerLocation, request?.pickupLocation]);

  // 4. Ajustement automatique de la carte (bounds) pour afficher demandeur et visualiseur
  const fitMapBounds = () => {
    if (!mapRef.current || !request?.pickupLocation) return;
    const map = mapRef.current.getMap ? mapRef.current.getMap() : mapRef.current;
    if (!map) return;

    if (!isOwner && viewerLocation) {
      const minLng = Math.min(viewerLocation.lng, request.pickupLocation.lng);
      const maxLng = Math.max(viewerLocation.lng, request.pickupLocation.lng);
      const minLat = Math.min(viewerLocation.lat, request.pickupLocation.lat);
      const maxLat = Math.max(viewerLocation.lat, request.pickupLocation.lat);

      if (Math.abs(minLng - maxLng) < 0.0001 && Math.abs(minLat - maxLat) < 0.0001) {
        map.easeTo({
          center: [request.pickupLocation.lng, request.pickupLocation.lat],
          zoom: 14,
          duration: 600,
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
            padding: 50,
            duration: 800,
            maxZoom: 15,
          }
        );
      } catch (e) {
        // Ignorer
      }
    } else {
      map.easeTo({
        center: [request.pickupLocation.lng, request.pickupLocation.lat],
        zoom: 14,
        duration: 600,
      });
    }
  };

  useEffect(() => {
    if (request?.pickupLocation) {
      setTimeout(fitMapBounds, 250);
    }
  }, [request?.pickupLocation, viewerLocation, isOwner]);

  // États pour les actions
  const [isCancelling, setIsCancelling] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Choix de l'heure par le conducteur avant confirmation
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [pickupDate, setPickupDate] = useState(todayStr);

  const defaultInitialTime = useMemo(() => {
    const d = new Date(Date.now() + 15 * 60 * 1000);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(Math.ceil(d.getMinutes() / 5) * 5 % 60).padStart(2, "0");
    return `${h}:${m}`;
  }, []);
  const [pickupTime, setPickupTime] = useState(defaultInitialTime);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  useEffect(() => {
    if (request?.note) {
      const { startHour } = parseTimeSlotFromNote(request.note);
      if (startHour && startHour >= 0 && startHour <= 23) {
        setPickupTime(`${String(startHour).padStart(2, "0")}:00`);
      }
    }
  }, [request?.note]);

  // Formulaire d'édition de la demande (pour le passager propriétaire)
  const [editPickupAddress, setEditPickupAddress] = useState("");
  const [editPickupCoords, setEditPickupCoords] = useState<{ lat: number; lng: number }>({
    lat: 48.8566,
    lng: 2.3522,
  });
  const [editDestAddress, setEditDestAddress] = useState("");
  const [editDestCoords, setEditDestCoords] = useState<{ lat: number; lng: number }>({
    lat: 48.8566,
    lng: 2.3522,
  });
  const [editSeats, setEditSeats] = useState(1);
  const [editStartHour, setEditStartHour] = useState(5);
  const [editEndHour, setEditEndHour] = useState(24);
  const [editNote, setEditNote] = useState("");

  const handleOpenEdit = () => {
    if (!request) return;
    setEditPickupAddress(resolvedPickupAddress || request.pickupLocation.address);
    setEditPickupCoords({
      lat: request.pickupLocation.lat,
      lng: request.pickupLocation.lng,
    });
    setEditDestAddress(resolvedDestAddress || request.destinationLocation?.address || "Église (Centre-ville)");
    setEditDestCoords({
      lat: request.destinationLocation?.lat || 48.8566,
      lng: request.destinationLocation?.lng || 2.3522,
    });
    setEditSeats(request.seatsRequested || 1);

    const { startHour, endHour, cleanNote } = parseTimeSlotFromNote(request.note);
    setEditStartHour(startHour);
    setEditEndHour(endHour);
    setEditNote(cleanNote);

    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!token || !request) return;
    if (editSeats < 1) {
      toast.error("Le nombre de places demandées doit être d'au moins 1.");
      return;
    }
    if (!editPickupAddress.trim()) {
      toast.error("Veuillez renseigner un lieu de prise en charge.");
      return;
    }

    setIsSaving(true);
    try {
      const timeNote = `Créneau : ${formatHourLabel(editStartHour)} - ${formatHourLabel(editEndHour)}`;
      const finalNote = editNote.trim() ? `${editNote.trim()} (${timeNote})` : timeNote;

      await updateRequestMutation({
        token,
        requestId: request._id,
        pickupLocation: {
          lat: editPickupCoords.lat,
          lng: editPickupCoords.lng,
          address: editPickupAddress.trim(),
        },
        destinationLocation: {
          lat: editDestCoords.lat,
          lng: editDestCoords.lng,
          address: editDestAddress.trim() || "Église (Centre-ville)",
        },
        seatsRequested: editSeats,
        note: finalNote,
      });

      setResolvedPickupAddress(editPickupAddress.trim());
      setResolvedDestAddress(editDestAddress.trim() || "Église (Centre-ville)");
      setShowEditModal(false);
      toast.success("Demande modifiée avec succès.");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la modification");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!token || !request) return;
    const ok = await confirm({
      title: "Annulation de la demande",
      message: "Êtes-vous sûr de vouloir annuler cette demande de trajet ?",
      confirmText: "Oui, annuler",
      cancelText: "Conserver",
      destructive: true,
    });
    if (!ok) return;

    setIsCancelling(true);
    try {
      await cancelPassengerRequest({
        token,
        requestId: request._id,
      });
      toast.success("Demande annulée.");
      router.push("/needs?tab=my");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'annulation");
    } finally {
      setIsCancelling(false);
    }
  };

  // Ouverture de la modale de planification horaire par le conducteur
  const handleOpenScheduleModal = () => {
    if (!token) {
      toast.info("Veuillez vous connecter pour proposer de récupérer ce passager.");
      router.push("/login");
      return;
    }
    setShowScheduleModal(true);
  };

  // Confirmation de la création automatique du trajet avec l'heure choisie par le conducteur
  const handleConfirmSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.info("Veuillez vous connecter pour proposer de récupérer ce passager.");
      router.push("/login");
      return;
    }
    if (!request) return;

    if (!pickupDate || !pickupTime) {
      toast.error("Veuillez choisir une date et une heure de départ.");
      return;
    }

    const [y, m, d] = pickupDate.split("-").map(Number);
    const [hours, minutes] = pickupTime.split(":").map(Number);
    const chosenTimestamp = new Date(y, m - 1, d, hours, minutes, 0, 0).getTime();

    setIsCreatingTrip(true);
    try {
      let lat = viewerLocation?.lat;
      let lng = viewerLocation?.lng;

      if (!lat || !lng) {
        if (user?.homeAddress?.lat && user?.homeAddress?.lng) {
          lat = user.homeAddress.lat;
          lng = user.homeAddress.lng;
        }
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
        requestId: request._id,
        departureTime: chosenTimestamp,
        driverLocation: {
          lat,
          lng,
          address: address || "Lieu de départ du conducteur",
        },
      });

      setShowScheduleModal(false);
      toast.success(
        `Trajet créé ! Le passager a été ajouté à votre véhicule.`
      );
      router.push(`/trips/${tripId}`);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création du trajet");
    } finally {
      setIsCreatingTrip(false);
    }
  };

  if (request === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f4f7fb]">
        <Loader2 className="h-7 w-7 animate-spin text-[#175276]" />
      </div>
    );
  }

  if (request === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f7fb] p-6 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-rose-500" />
        <h2 className="text-base font-bold text-[#1a3860]">Demande introuvable</h2>
        <p className="text-xs text-[#7d8fa5]">Cette demande n'existe pas ou a été annulée.</p>
        <button
          onClick={() => router.push("/needs")}
          className="px-4 py-2 rounded-xl bg-[#175276] text-white text-xs font-bold"
        >
          Retour aux demandes
        </button>
      </div>
    );
  }

  const addedRelativeText = formatRelativeAdded(request.createdAt, currentTime);

  return (
    <div className="relative min-h-dvh bg-[#f4f7fb] text-slate-800 pb-24 select-none overflow-x-hidden">
      {/* Halos d'ambiance glassy subtils */}
      <div className="pointer-events-none fixed -top-20 -right-20 h-80 w-80 rounded-full bg-teal-200/20 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-1/3 -left-20 h-72 w-72 rounded-full bg-blue-100/30 blur-3xl z-0" />

      {/* 1. EN-TÊTE FIXE GLASSY */}
      <div
        className="sticky top-0 z-30 glass-panel bg-white/85 backdrop-blur-2xl border-b border-white/80 px-4 pb-3 shadow-2xs"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))" }}
      >
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (isOwner) router.push("/needs?tab=my");
                else router.push("/needs?tab=others");
              }}
              className="flex h-9 w-9 items-center justify-center rounded-2xl glass-card bg-white/90 text-[#1a3860] hover:bg-white active:scale-95 transition-all shadow-2xs border border-white/90"
              title="Retour aux demandes"
            >
              <ChevronLeft className="h-5 w-5 stroke-[2.4]" />
            </button>
            <h1 className="text-base font-bold text-[#1a3860]">
              {isOwner ? "Ma demande" : "Détails de la demande"}
            </h1>
          </div>

          <span className="text-xs font-semibold text-[#7d8fa5]">
            {addedRelativeText}
          </span>
        </div>
      </div>

      <div className="relative z-10 max-w-md mx-auto p-4 space-y-3.5">
        {/* BLOC DATE ET CRÉNEAU DE LA DEMANDE */}
        <div className="rounded-3xl glass-card bg-white/95 backdrop-blur-xl p-4 border border-white/90 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#e6f4f0] text-[#138872] flex-shrink-0">
                <Calendar className="h-4.5 w-4.5 stroke-[2.2]" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Date de la demande
                </p>
                <p className="text-xs sm:text-sm font-black text-[#1a3860]">
                  {formatDemandDate(request.createdAt)}
                </p>
              </div>
            </div>

            <span className="text-[11px] font-semibold text-[#7d8fa5] bg-slate-100 px-2.5 py-1 rounded-full">
              {addedRelativeText}
            </span>
          </div>

          {parsedSlot.hasSlot && (
            <div className="pt-2 border-t border-slate-100/90 flex items-center gap-2 text-xs font-bold text-[#175276]">
              <Clock className="h-3.5 w-3.5 text-[#249e83] flex-shrink-0" />
              <span>Créneau horaire souhaité : {parsedSlot.startHour}h - {parsedSlot.endHour}h</span>
            </div>
          )}
        </div>
        {/* ======================================================== */}
        {/* 2. SI VISUALISÉ PAR UN AUTRE MEMBRE : PROFIL DU DEMANDEUR */}
        {/* ======================================================== */}
        {!isOwner && (
          <div className="rounded-3xl glass-card bg-white/90 backdrop-blur-xl p-4 border border-white/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 ring-2 ring-white shadow-xs overflow-hidden flex-shrink-0">
                  {request.passenger?.avatarUrl ? (
                    <img
                      src={request.passenger.avatarUrl}
                      alt={request.passenger.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold text-[#175276]">
                      {request.passenger?.name?.charAt(0) || "P"}
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-[#1a3860]">
                      {request.passenger?.name || "Passager"}
                    </span>
                    <VerifiedTicker status={request.passenger?.status} />
                  </div>
                  <p className="text-[11px] text-[#7d8fa5] mt-0.5">
                    Membre de la paroisse • Demande {request.seatsRequested} place{request.seatsRequested > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Badge En attente */}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-50 text-[#138872] border border-teal-200 shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-[#138872] animate-pulse" />
                <span>Libre</span>
              </span>
            </div>

            {/* BOUTON D'APPEL DIRECT (sans affichage direct des chiffres) */}
            {request.passenger?.phoneNumber ? (
              <a
                href={`tel:${request.passenger.phoneNumber}`}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Phone className="h-4 w-4 fill-white" />
                <span>Appeler le passager</span>
              </a>
            ) : (
              <div className="w-full py-2.5 rounded-2xl bg-slate-100 text-slate-400 text-xs font-medium text-center flex items-center justify-center gap-2">
                <Phone className="h-4 w-4 text-slate-300" />
                <span>Numéro de téléphone non renseigné</span>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. DISTANCE CALCULÉE ENTRE LE CONDUCTEUR ET LE DEMANDEUR  */}
        {/* ======================================================== */}
        {!isOwner && distanceInfo && (
          <div className="rounded-2xl bg-white/95 border border-teal-100 p-3.5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-[#138872] flex-shrink-0">
                <Navigation className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Distance jusqu'au demandeur
                </p>
                <p className="text-sm font-extrabold text-[#1a3860]">
                  À {distanceInfo.formatted} de votre position
                </p>
              </div>
            </div>

            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-teal-100 text-[#138872]">
              {distanceInfo.meters < 3000 ? "Proche" : "Environs"}
            </span>
          </div>
        )}

        {/* ======================================================== */}
        {/* 4. CARTE INTERACTIVE AVEC LOCALISATIONS PRÉCISES          */}
        {/* ======================================================== */}
        <div className="rounded-3xl glass-card bg-white p-3.5 border border-slate-100 shadow-sm space-y-3.5">
          {/* APERÇU CARTE CENTRÉE */}
          <div className="rounded-2xl overflow-hidden h-48 sm:h-56 border border-slate-100 relative shadow-2xs bg-slate-100">
            <Map
              ref={mapRef}
              initialViewState={{
                latitude: request.pickupLocation.lat,
                longitude: request.pickupLocation.lng,
                zoom: 14,
              }}
              onLoad={() => {
                setTimeout(fitMapBounds, 150);
              }}
              mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
              attributionControl={false}
              style={{ width: "100%", height: "100%" }}
            >
              <NavigationControl position="top-right" />

              {/* Marqueur Prise en charge du demandeur */}
              <Marker
                latitude={request.pickupLocation.lat}
                longitude={request.pickupLocation.lng}
                anchor="bottom"
              >
                <div className="relative flex flex-col items-center">
                  <div className="px-2 py-0.5 mb-1 rounded-md bg-[#1a3860] text-white text-[9px] font-bold shadow-xs whitespace-nowrap">
                    {isOwner ? "Votre prise en charge" : request.passenger?.name || "Prise en charge"}
                  </div>
                  <div className="relative flex items-center justify-center">
                    <div className="absolute h-10 w-10 rounded-full bg-[#138872]/20 animate-ping" />
                    <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#138872] text-white shadow-md ring-2 ring-white">
                      <MapPin className="h-4 w-4 fill-white" />
                    </div>
                  </div>
                </div>
              </Marker>

              {/* Marqueur Visualiseur (Vous) */}
              {!isOwner && viewerLocation && (
                <Marker
                  latitude={viewerLocation.lat}
                  longitude={viewerLocation.lng}
                  anchor="bottom"
                >
                  <div className="relative flex flex-col items-center">
                    <div className="px-2 py-0.5 mb-1 rounded-md bg-blue-600 text-white text-[9px] font-bold shadow-xs whitespace-nowrap">
                      Votre position
                    </div>
                    <div className="relative flex items-center justify-center">
                      <div className="absolute h-9 w-9 rounded-full bg-blue-500/25 animate-pulse" />
                      <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-md ring-2 ring-white">
                        <Navigation className="h-3.5 w-3.5 fill-white" />
                      </div>
                    </div>
                  </div>
                </Marker>
              )}
            </Map>
          </div>

          {/* ITINÉRAIRE AVEC ADRESSES RÉELLES POSTALES */}
          <div className="space-y-2 px-1">
            {/* Lieu de prise en charge */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 text-[#138872] flex-shrink-0">
                <MapPin className="h-4 w-4 stroke-[2.2]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-[#1a3860] block truncate">
                  {resolvedPickupAddress || request.pickupLocation.address}
                </span>
                <span className="text-[11px] text-[#7d8fa5] block mt-0.5">
                  Lieu de prise en charge
                </span>
              </div>
            </div>

            <div className="ml-3.5 w-0.5 h-4 border-l-2 border-dashed border-slate-300" />

            {/* Destination */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-[#175276] flex-shrink-0">
                <MapPin className="h-4 w-4 fill-[#175276]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-[#1a3860] block truncate">
                  {resolvedDestAddress || request.destinationLocation?.address || "Église (Centre-ville)"}
                </span>
                <span className="text-[11px] text-[#7d8fa5] block mt-0.5">
                  Destination
                </span>
              </div>
            </div>
          </div>

          {/* DÉTAILS COMPLÉMENTAIRES (PLACES DEMANDÉES & CRÉNEAU / NOTE) */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-medium text-[11px]">
              <Users className="h-3.5 w-3.5 text-[#175276]" />
              <span>
                {request.seatsRequested} place{request.seatsRequested > 1 ? "s" : ""} demandée{request.seatsRequested > 1 ? "s" : ""}
              </span>
            </div>

            {request.note && (
              <span className="text-[11px] font-medium text-slate-500 truncate max-w-[200px]">
                {request.note}
              </span>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 5. BOUTONS D'ACTION SELON LE PROPRIÉTAIRE OU VISITEUR    */}
        {/* ======================================================== */}
        {isOwner ? (
          /* VUE PASSAGER (PROPRIÉTAIRE) : MODIFIER & ANNULER */
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleOpenEdit}
                disabled={request.status === "cancelled"}
                className="py-3.5 px-4 rounded-full border border-blue-200/90 bg-white hover:bg-blue-50/50 text-[#175276] text-xs font-bold transition-all shadow-2xs active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Modifier</span>
              </button>

              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling || request.status === "cancelled"}
                className="py-3.5 px-4 rounded-full border border-rose-200 bg-white hover:bg-rose-50 text-rose-500 text-xs font-bold transition-all shadow-2xs active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isCancelling ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-500" />
                ) : (
                  <X className="h-3.5 w-3.5 stroke-[2.5]" />
                )}
                <span>
                  {request.status === "cancelled" ? "Annulée" : "Annuler"}
                </span>
              </button>
            </div>

            <div className="rounded-2xl bg-[#eef8fd] border border-[#d6effd] p-3.5 flex items-center gap-3 shadow-2xs">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-600 text-white flex-shrink-0 shadow-xs">
                <MapPin className="h-4 w-4 fill-white" />
              </div>
              <p className="text-xs font-medium text-[#175276] leading-relaxed">
                Vous serez notifié dès qu'un conducteur acceptera votre demande.
              </p>
            </div>
          </div>
        ) : (
          /* VUE CONDUCTEUR (AUTRE MEMBRE) : CHOISIR L'HEURE ET CRÉER LE TRAJET */
          <div className="pt-1">
            <button
              type="button"
              onClick={handleOpenScheduleModal}
              disabled={isCreatingTrip}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] hover:opacity-95 text-white text-xs sm:text-sm font-bold shadow-md shadow-[#175276]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Car className="h-4 w-4" />
              <span>Proposer de le récupérer</span>
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 6. MODALE CONDUCTEUR : CHOIX DE L'HEURE AVANT CONFIRMATION */}
      {/* ======================================================== */}
      {showScheduleModal && (
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
                    Récupérer {request.passenger?.name || "le passager"}
                  </h3>
                  <p className="text-[10px] text-[#7d8fa5]">
                    Définissez l'heure de départ de votre trajet
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
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
                  <span>{request.seatsRequested} place{request.seatsRequested > 1 ? "s" : ""}</span>
                </span>
              </div>

              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-start gap-2 text-slate-700">
                  <div className="h-2 w-2 rounded-full bg-[#138872] flex-shrink-0 mt-1" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-medium">Prise en charge</span>
                    <span className="truncate font-semibold block text-slate-800">
                      {resolvedPickupAddress || request.pickupLocation.address}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-slate-700">
                  <div className="h-2 w-2 rounded-full bg-[#175276] flex-shrink-0 mt-1" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-medium">Destination</span>
                    <span className="truncate font-semibold block text-slate-800">
                      {resolvedDestAddress || request.destinationLocation?.address || "Église (Centre-ville)"}
                    </span>
                  </div>
                </div>
              </div>

              {request.note && (
                <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/60">
                  "{request.note}"
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
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTrip}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] hover:opacity-95 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isCreatingTrip ? (
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

      {/* ======================================================== */}
      {/* 7. MODALE GLASSY D'ÉDITION DE LA DEMANDE (POUR PROPRIÉTAIRE) */}
      {/* ======================================================== */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Titre modale */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#175276]">
                  <Pencil className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-[#1a3860]">
                  Modifier ma demande
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Formulaire */}
            <div className="space-y-3.5 text-xs">
              {/* 1. Lieu de prise en charge avec autocomplétion */}
              <div className="space-y-1">
                <label className="font-bold text-[#1a3860] flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" />
                  <span>Lieu de prise en charge</span>
                </label>
                <AddressAutocompleteInput
                  value={editPickupAddress}
                  onChange={(address, coords) => {
                    setEditPickupAddress(address);
                    if (coords) {
                      setEditPickupCoords(coords);
                    }
                  }}
                  placeholder="Votre adresse ou point de repère"
                  inputClassName="py-2.5 px-3 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500"
                />
              </div>

              {/* 2. Destination */}
              <div className="space-y-1">
                <label className="font-bold text-[#1a3860] flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[#138872]" />
                  <span>Destination</span>
                </label>
                <AddressAutocompleteInput
                  value={editDestAddress}
                  onChange={(address, coords) => {
                    setEditDestAddress(address);
                    if (coords) {
                      setEditDestCoords(coords);
                    }
                  }}
                  placeholder="Église ou destination"
                  inputClassName="py-2.5 px-3 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#138872]"
                />
              </div>

              {/* 3. Nombre de places */}
              <div className="space-y-1">
                <label className="font-bold text-[#1a3860] flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-slate-500" />
                  <span>Nombre de passagers</span>
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditSeats((s) => Math.max(1, s - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold hover:bg-slate-100"
                  >
                    -
                  </button>
                  <span className="font-bold text-sm text-[#1a3860] min-w-[30px] text-center">
                    {editSeats}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditSeats((s) => Math.min(8, s + 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold hover:bg-slate-100"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 4. Plage horaire souhaitée */}
              <div className="space-y-1">
                <label className="font-bold text-[#1a3860] flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  <span>Plage horaire souhaitée</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <span className="text-[10px] text-slate-400 block mb-0.5">De</span>
                    <select
                      value={editStartHour}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setEditStartHour(val);
                        if (val >= editEndHour) setEditEndHour(Math.min(24, val + 1));
                      }}
                      className="w-full py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-700 focus:bg-white"
                    >
                      {START_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {formatHourLabel(h)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] text-slate-400 block mb-0.5">À</span>
                    <select
                      value={editEndHour}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setEditEndHour(val);
                        if (val <= editStartHour) setEditStartHour(Math.max(0, val - 1));
                      }}
                      className="w-full py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-700 focus:bg-white"
                    >
                      {END_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {formatHourLabel(h)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 5. Note / Remarque pour le conducteur */}
              <div className="space-y-1">
                <label className="font-bold text-[#1a3860]">
                  Remarque ou précision (facultatif)
                </label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Ex : J'ai un sac volumineux, ou nous sommes avec un enfant..."
                  rows={2}
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-blue-500"
                />
              </div>
            </div>

            {/* Boutons d'action de la modale */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] hover:opacity-95 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>Enregistrer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barre de navigation inférieure */}
      <BottomNav userRole={user?.role ?? "user"} />
    </div>
  );
}

export default function RequestDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#f4f7fb]">
          <Loader2 className="h-7 w-7 animate-spin text-[#175276]" />
        </div>
      }
    >
      <RequestDetailsContent />
    </Suspense>
  );
}