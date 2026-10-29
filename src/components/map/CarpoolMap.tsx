"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";
import {
  Car,
  User,
  Church,
  Phone,
  Clock,
  Users,
  MapPin,
  X,
  ChevronRight,
  SlidersHorizontal,
  LocateFixed,
  Navigation,
  Compass,
  Check,
} from "lucide-react";
import { VerifiedTicker } from "@/components/ui/VerifiedTicker";
import { getOptimalWaypointsOrder, getDistanceMeters } from "@/lib/geo";
import { GpsChooserModal } from "@/components/navigation/GpsChooserModal";
import { useToast } from "@/components/ui/ToastProvider";

export interface LocationPoint {
  lat: number;
  lng: number;
  address: string;
}

export interface TripItem {
  _id: string;
  driverId: string;
  driver?: {
    _id: string;
    name: string;
    avatarUrl?: string;
    phoneNumber?: string | null;
    status?: string;
  } | null;
  departureLocation: LocationPoint;
  destinationLocation: LocationPoint;
  departureTime: number;
  totalSeats: number;
  availableSeats: number;
  notes?: string;
}

export interface NeedItem {
  _id: string;
  passengerId: string;
  passenger?: {
    _id: string;
    name: string;
    avatarUrl?: string;
    status?: string;
  } | null;
  pickupLocation: LocationPoint;
  seatsRequested: number;
  note?: string;
}

export interface UpcomingEscaleItem {
  requestId: string;
  passengerId: string;
  passengerName: string;
  passengerAvatar?: string;
  passengerStatus?: string;
  passengerPhone?: string;
  pickupLocation: LocationPoint;
  seatsRequested: number;
  note?: string;
}

export interface UpcomingTripItem {
  _id: string;
  role: "driver" | "passenger";
  status?: "planned" | "active" | "completed" | "cancelled";
  title?: string;
  departureTime: number;
  availableSeats: number;
  totalSeats: number;
  seatsRequested?: number;
  driverId?: string;
  driverName?: string;
  driverStatus?: string;
  driverPhone?: string;
  driverAvatar?: string;
  departureLocation?: LocationPoint;
  destinationLocation?: LocationPoint;
  departureAddress?: string;
  destinationAddress?: string;
  myPickupLocation?: LocationPoint;
  currentLocation?: { lat: number; lng: number; updatedAt?: number };
  nextDestinationName?: string;
  currentEscaleIndex?: number;
  startedAt?: number;
  escales?: UpcomingEscaleItem[];
}

interface CarpoolMapProps {
  trips: TripItem[];
  needs: NeedItem[];
  currentUserId?: string;
  churchLocation?: LocationPoint;
  nextTrip?: UpcomingTripItem | null;
  onRequestSeat?: (tripId: string) => void;
  onPickUpNeed?: (needId: string) => void;
  onCreateTripClick?: (coords?: { lat: number; lng: number }) => void;
  onSignalNeedClick?: (coords?: { lat: number; lng: number }) => void;
  onStartTrip?: (tripId: string, coords?: { lat: number; lng: number }, nextDestinationName?: string) => Promise<void> | void;
  onUpdateDriverLocation?: (tripId: string, coords: { lat: number; lng: number }, nextDestinationName?: string) => Promise<void> | void;
  onAdvanceEscale?: (tripId: string, nextIndex: number, nextDestinationName?: string) => Promise<void> | void;
  onCompleteTrip?: (tripId: string) => Promise<void> | void;
  acceptedTripPhoneNumbers?: Record<string, string>;
}

export const CarpoolMap: React.FC<CarpoolMapProps> = ({
  trips = [],
  needs = [],
  currentUserId,
  churchLocation = {
    lat: 48.8566,
    lng: 2.3522,
    address: "Église Centrale, 12 rue de la Paix",
  },
  nextTrip = null,
  onRequestSeat,
  onPickUpNeed,
  onCreateTripClick,
  onSignalNeedClick,
  onStartTrip,
  onUpdateDriverLocation,
  onAdvanceEscale,
  onCompleteTrip,
  acceptedTripPhoneNumbers = {},
}) => {
  const router = useRouter();
  const { confirm, toast } = useToast();

  // Localisation réelle de l'utilisateur (s'il accepte)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Filtre d'affichage (tous / voitures / besoins)
  const [filter, setFilter] = useState<"all" | "trips" | "needs">("all");
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Sélection active pour la Bottom Sheet (quand on clique sur un pin)
  const [selectedTrip, setSelectedTrip] = useState<TripItem | null>(null);
  const [selectedNeed, setSelectedNeed] = useState<NeedItem | null>(null);
  const [showGpsChooser, setShowGpsChooser] = useState(false);

  // Position par défaut de la carte
  const [viewState, setViewState] = useState({
    longitude: churchLocation.lng,
    latitude: churchLocation.lat,
    zoom: 13,
  });

  // Demande de géolocalisation native à l'ouverture s'il accepte
  const requestGeolocation = (isUserClick = false) => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      if (isUserClick) {
        toast.error("La géolocalisation n'est pas supportée sur ce navigateur.");
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(loc);
        // Centraliser directement la carte sur la localisation de l'utilisateur
        setViewState({
          latitude: loc.lat,
          longitude: loc.lng,
          zoom: 13.8,
        });
        if (isUserClick) {
          toast.success("Position actualisée !");
        }
      },
      (err) => {
        console.warn("Échec GPS haute précision :", err.code, err.message);
        // Si permission expressément refusée
        if (err.code === 1) {
          if (isUserClick) {
            toast.error(
              "Position refusée. Sur iPhone : appuyez sur 'aA' dans Safari > Réglages du site web > Emplacement > Autoriser."
            );
          }
          return;
        }

        // Sinon (timeout, position indisponible), repli vers mode standard (cellulaire/wifi)
        navigator.geolocation.getCurrentPosition(
          (pos2) => {
            const loc2 = {
              lat: pos2.coords.latitude,
              lng: pos2.coords.longitude,
            };
            setUserLocation(loc2);
            setViewState({
              latitude: loc2.lat,
              longitude: loc2.lng,
              zoom: 13.8,
            });
            if (isUserClick) {
              toast.success("Position détectée !");
            }
          },
          () => {
            if (isUserClick) {
              toast.error(
                "Signal GPS introuvable. Vérifiez que la localisation est activée dans vos Réglages iPhone."
              );
            }
          },
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    requestGeolocation(false);
  }, []);

  const mapRef = useRef<any>(null);

  // Heure temps réel mise à jour chaque seconde pour le décompte fluide
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Détection de trajet imminent : à 5 minutes ou moins du départ, ou si le conducteur est déjà en route ("active")
  const diffMs = nextTrip ? nextTrip.departureTime - currentTime : Infinity;
  const isTripImminent = Boolean(
    nextTrip &&
      (nextTrip.status === "active" || diffMs <= 5 * 60 * 1000) &&
      nextTrip.status !== "completed" &&
      nextTrip.status !== "cancelled"
  );

  // Formatage du décompte affiché à côté du trajet
  const countdown = useMemo(() => {
    if (!nextTrip) return { text: "", isPast: false };
    const diff = nextTrip.departureTime - currentTime;
    if (diff <= 0) {
      const pastSec = Math.floor(Math.abs(diff) / 1000);
      const pastMin = Math.floor(pastSec / 60);
      if (pastMin < 1) return { text: "00:00", isPast: true };
      return { text: `+${pastMin}m`, isPast: true };
    }
    const totalSec = Math.floor(diff / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return {
      text: `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`,
      isPast: false,
    };
  }, [nextTrip?.departureTime, currentTime]);

  // Calcul du meilleur parcours : ordre de succession optimal des passagers (escales)
  const optimalEscales = useMemo(() => {
    if (
      !nextTrip ||
      !nextTrip.departureLocation ||
      !nextTrip.destinationLocation
    ) {
      return nextTrip?.escales || [];
    }
    return getOptimalWaypointsOrder(
      nextTrip.departureLocation,
      nextTrip.destinationLocation,
      nextTrip.escales || []
    );
  }, [nextTrip]);

  // Prochaine destination du conducteur
  const driverNextDestination = useMemo(() => {
    if (!nextTrip) return "";
    if (nextTrip.nextDestinationName) return nextTrip.nextDestinationName;
    if (optimalEscales && optimalEscales.length > 0) {
      const firstEscale = optimalEscales[0];
      if (nextTrip.role === "passenger" && firstEscale.passengerId === currentUserId) {
        return "Vers vous ! (Prise en charge à votre adresse)";
      }
      return `Prise en charge de ${firstEscale.passengerName}`;
    }
    return nextTrip.destinationLocation?.address?.includes("Église")
      ? "Église (Destination finale)"
      : nextTrip.destinationLocation?.address || "Église";
  }, [nextTrip, optimalEscales, currentUserId]);

  // Distance en temps réel entre le conducteur et le point de rendez-vous du passager
  const passengerDistanceInfo = useMemo(() => {
    if (
      !nextTrip ||
      nextTrip.role !== "passenger" ||
      !nextTrip.myPickupLocation
    ) {
      return null;
    }
    const driverLoc = nextTrip.currentLocation || nextTrip.departureLocation;
    if (!driverLoc) return null;

    const dMeters = getDistanceMeters(
      driverLoc.lat,
      driverLoc.lng,
      nextTrip.myPickupLocation.lat,
      nextTrip.myPickupLocation.lng
    );
    const dKm = dMeters / 1000;
    const estMin = Math.max(1, Math.round(dKm * 2.2 + 2));
    const distStr = dKm < 1 ? `${Math.round(dMeters)} m` : `${dKm.toFixed(1).replace(".", ",")} km`;
    return {
      distStr,
      estMin,
      isClose: dMeters <= 300,
    };
  }, [nextTrip]);

  // Suivi de la position GPS du conducteur en direct quand le trajet est actif
  const watchIdRef = useRef<number | null>(null);

  const startWatchingDriverPosition = (tripId: string) => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(coords);
          onUpdateDriverLocation?.(tripId, coords, driverNextDestination);
        },
        (err) => console.log("watchPosition err:", err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
      );
    }
  };

  useEffect(() => {
    if (nextTrip && nextTrip.role === "driver" && nextTrip.status === "active") {
      startWatchingDriverPosition(nextTrip._id);
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [nextTrip?._id, nextTrip?.role, nextTrip?.status]);

  // Progression des escales du conducteur
  const currentEscaleIndex = nextTrip?.currentEscaleIndex || 0;
  const currentEscale = optimalEscales[currentEscaleIndex] || null;
  const isAllEscalesDone = optimalEscales.length === 0 || currentEscaleIndex >= optimalEscales.length;

  const handleAdvanceEscale = async () => {
    if (!nextTrip) return;
    const nextIdx = currentEscaleIndex + 1;
    let nextDest = "Église (Destination finale)";
    if (nextIdx < optimalEscales.length) {
      nextDest = `Prise en charge de ${optimalEscales[nextIdx].passengerName}`;
    }
    try {
      await onAdvanceEscale?.(nextTrip._id, nextIdx, nextDest);
    } catch (e) {
      console.warn("handleAdvanceEscale err:", e);
    }
  };

  const handleCompleteTrip = async () => {
    if (!nextTrip) return;
    const ok = await confirm({
      title: "Fin du trajet",
      message: "Êtes-vous bien arrivé ? Marquer le trajet comme terminé ?",
      confirmText: "Oui, terminé",
      cancelText: "Pas encore",
    });
    if (ok) {
      try {
        await onCompleteTrip?.(nextTrip._id);
        toast.success("Trajet terminé avec succès !");
      } catch (e) {
        console.warn("handleCompleteTrip err:", e);
      }
    }
  };

  const handleDriverGoClick = async () => {
    if (!nextTrip) return;
    try {
      await onStartTrip?.(
        nextTrip._id,
        userLocation || undefined,
        driverNextDestination
      );
      startWatchingDriverPosition(nextTrip._id);
    } catch (e) {
      console.warn("handleDriverGoClick:", e);
    }
    setShowGpsChooser(true);
  };

  // Synchronisation de la ligne d'itinéraire optimisée (Départ -> Escales -> Destination)
  const syncImminentRouteLayer = () => {
    if (!mapRef.current || !isTripImminent || !nextTrip) return;
    const map = mapRef.current.getMap ? mapRef.current.getMap() : mapRef.current;
    if (!map || typeof map.isStyleLoaded !== "function" || !map.isStyleLoaded()) return;

    try {
      let coords: [number, number][] = [];

      if (nextTrip.role === "driver") {
        if (!nextTrip.departureLocation || !nextTrip.destinationLocation) return;
        const start = nextTrip.currentLocation || nextTrip.departureLocation;
        const remainingEscales = optimalEscales.slice(currentEscaleIndex);
        coords = [
          [start.lng, start.lat],
          ...remainingEscales.map((e) => [e.pickupLocation.lng, e.pickupLocation.lat] as [number, number]),
          [nextTrip.destinationLocation.lng, nextTrip.destinationLocation.lat],
        ];
      } else if (nextTrip.role === "passenger") {
        const driverLoc = nextTrip.currentLocation || nextTrip.departureLocation;
        if (!driverLoc || !nextTrip.destinationLocation) return;
        coords = [
          [driverLoc.lng, driverLoc.lat],
          ...(nextTrip.myPickupLocation
            ? [[nextTrip.myPickupLocation.lng, nextTrip.myPickupLocation.lat] as [number, number]]
            : []),
          [nextTrip.destinationLocation.lng, nextTrip.destinationLocation.lat],
        ];
      }

      if (coords.length < 2) return;

      const routeGeoJSON = {
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: coords,
        },
        properties: {},
      };

      const sourceId = "imminent-route-source";
      const existingSource = map.getSource(sourceId);

      if (existingSource) {
        (existingSource as any).setData(routeGeoJSON);
      } else {
        map.addSource(sourceId, {
          type: "geojson",
          data: routeGeoJSON,
        });

        if (!map.getLayer("imminent-route-casing")) {
          map.addLayer({
            id: "imminent-route-casing",
            type: "line",
            source: sourceId,
            paint: {
              "line-color": "#ffffff",
              "line-width": 6,
              "line-opacity": 0.9,
            },
          });
        }

        if (!map.getLayer("imminent-route-main")) {
          map.addLayer({
            id: "imminent-route-main",
            type: "line",
            source: sourceId,
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": nextTrip.role === "driver" ? "#138872" : "#2d6cb5",
              "line-width": 4,
            },
          });
        }
      }
    } catch (e) {
      console.warn("syncImminentRouteLayer :", e);
    }
  };

  const fitImminentRouteBounds = () => {
    if (!mapRef.current || !isTripImminent || !nextTrip) return;
    const map = mapRef.current.getMap ? mapRef.current.getMap() : mapRef.current;
    if (!map) return;

    let allPts: LocationPoint[] = [];

    if (nextTrip.role === "driver") {
      if (!nextTrip.departureLocation || !nextTrip.destinationLocation) return;
      const remainingEscales = optimalEscales.slice(currentEscaleIndex);
      allPts = [
        nextTrip.currentLocation
          ? { ...nextTrip.currentLocation, address: "Conducteur" }
          : nextTrip.departureLocation,
        ...remainingEscales.map((e) => e.pickupLocation),
        nextTrip.destinationLocation,
      ];
    } else if (nextTrip.role === "passenger") {
      const driverLoc = nextTrip.currentLocation || nextTrip.departureLocation;
      if (!driverLoc || !nextTrip.destinationLocation) return;
      allPts = [
        { lat: driverLoc.lat, lng: driverLoc.lng, address: "Conducteur" },
        ...(nextTrip.myPickupLocation ? [nextTrip.myPickupLocation] : []),
        nextTrip.destinationLocation,
      ];
    }

    if (allPts.length === 0) return;

    const minLng = Math.min(...allPts.map((p) => p.lng));
    const maxLng = Math.max(...allPts.map((p) => p.lng));
    const minLat = Math.min(...allPts.map((p) => p.lat));
    const maxLat = Math.max(...allPts.map((p) => p.lat));

    if (Math.abs(minLng - maxLng) < 0.0001 && Math.abs(minLat - maxLat) < 0.0001) {
      map.easeTo({
        center: [minLng, minLat],
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
          padding: { top: 90, bottom: 330, left: 50, right: 50 },
          duration: 900,
          maxZoom: 15.5,
        }
      );
    } catch (e) {
      console.warn("fitImminentRouteBounds :", e);
    }
  };

  useEffect(() => {
    if (isTripImminent && nextTrip) {
      syncImminentRouteLayer();
      setTimeout(fitImminentRouteBounds, 250);
    }
  }, [
    isTripImminent,
    nextTrip?._id,
    nextTrip?.status,
    nextTrip?.currentLocation?.lat,
    nextTrip?.currentLocation?.lng,
    optimalEscales,
  ]);

  // Position active affichée pour le radar : vraie localisation si accordée, sinon repli
  const activeUserPos = useMemo(() => {
    if (userLocation) return userLocation;
    return {
      lat: churchLocation.lat - 0.007,
      lng: churchLocation.lng,
    };
  }, [userLocation, churchLocation]);

  // Calcul dynamique de la distance vers l'église
  const distanceInfo = useMemo(() => {
    const lat = activeUserPos.lat;
    const lng = activeUserPos.lng;
    const R = 6371; // Rayon Terre en km
    const dLat = ((churchLocation.lat - lat) * Math.PI) / 180;
    const dLng = ((churchLocation.lng - lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((churchLocation.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;
    const durationMin = Math.max(3, Math.round(dist * 2.2 + 2));
    const distStr = dist < 10 ? dist.toFixed(1).replace(".", ",") : Math.round(dist).toString();
    return `${distStr} km • ${durationMin} min`;
  }, [activeUserPos, churchLocation]);

  const visibleTrips = useMemo(() => {
    if (filter === "needs") return [];
    return trips;
  }, [trips, filter]);

  const visibleNeeds = useMemo(() => {
    if (filter === "trips") return [];
    return needs;
  }, [needs, filter]);

  const formatHour = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-slate-100 select-none">
      {/* 1. CARTE INTERACTIVE TEMPS RÉEL (STYLE POSITRON MINIMALISTE IDENTIQUE À L'IMAGE) */}
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onLoad={() => {
          if (isTripImminent && nextTrip) {
            setTimeout(() => {
              syncImminentRouteLayer();
              fitImminentRouteBounds();
            }, 100);
          }
        }}
        onIdle={() => {
          if (isTripImminent && nextTrip) {
            syncImminentRouteLayer();
          }
        }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" />

        {/* 1.1 EN MODE TRAJET IMMINENT CONDUCTEUR : ITINÉRAIRE DÉTAILLÉ (DÉPART -> ESCALES OPTIMALES -> DESTINATION) */}
        {isTripImminent && nextTrip?.role === "driver" ? (
          <>
            {/* Position de départ ou position actuelle en direct du conducteur */}
            {(() => {
              const driverPos = nextTrip.currentLocation || nextTrip.departureLocation;
              if (!driverPos) return null;
              const isLive = Boolean(nextTrip.currentLocation || nextTrip.status === "active");

              return (
                <Marker
                  latitude={driverPos.lat}
                  longitude={driverPos.lng}
                  anchor="bottom"
                >
                  <div className="relative flex flex-col items-center">
                    <div className="px-2 py-0.5 mb-1 rounded-md bg-[#1a3860] text-white text-[9px] font-bold shadow-xs whitespace-nowrap flex items-center gap-1">
                      {isLive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />}
                      <span>Vous {isLive ? "(En direct)" : "(Départ)"}</span>
                    </div>
                    <div className="relative flex items-center justify-center">
                      {isLive && <div className="absolute h-10 w-10 rounded-full bg-[#1a3860]/25 animate-ping" />}
                      <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#1a3860] text-white ring-2 ring-white shadow-md">
                        <Car className="h-4.5 w-4.5 stroke-[2.2]" />
                      </div>
                    </div>
                    <div className="h-2 w-2 rotate-45 bg-[#1a3860] -mt-1 ring-1 ring-white" />
                  </div>
                </Marker>
              );
            })()}

            {/* Points d'escales ordonnés pour le meilleur parcours */}
            {optimalEscales.map((escale, idx) => {
              const isPast = nextTrip.status === "active" && idx < currentEscaleIndex;
              const isCurrent = nextTrip.status === "active" && idx === currentEscaleIndex;

              return (
                <Marker
                  key={escale.requestId}
                  latitude={escale.pickupLocation.lat}
                  longitude={escale.pickupLocation.lng}
                  anchor="bottom"
                >
                  <div className={`relative flex flex-col items-center ${isPast ? "opacity-50" : ""}`}>
                    <div
                      className={`px-2 py-0.5 mb-1 rounded-md text-white text-[9px] font-bold shadow-xs whitespace-nowrap flex items-center gap-1 ${
                        isCurrent
                          ? "bg-amber-600 ring-2 ring-white"
                          : isPast
                          ? "bg-slate-400"
                          : "bg-[#138872]"
                      }`}
                    >
                      <span className="font-extrabold">{idx + 1}.</span>
                      <span>{escale.passengerName}</span>
                      {isCurrent && (
                        <span className="text-[8px] bg-white text-amber-700 px-1 rounded font-black">
                          Prochain
                        </span>
                      )}
                      {isPast && <span>✓</span>}
                    </div>
                    <div className="relative flex items-center justify-center">
                      {isCurrent && <div className="absolute h-10 w-10 rounded-full bg-amber-500/30 animate-ping" />}
                      <div
                        className={`relative flex h-8 w-8 items-center justify-center rounded-full text-white font-extrabold text-xs ring-2 ring-white shadow-md ${
                          isCurrent
                            ? "bg-amber-500"
                            : isPast
                            ? "bg-slate-400"
                            : "bg-[#138872]"
                        }`}
                      >
                        {isPast ? <Check className="h-4 w-4" /> : idx + 1}
                      </div>
                    </div>
                    <div
                      className={`h-2 w-2 rotate-45 -mt-1 ring-1 ring-white ${
                        isCurrent
                          ? "bg-amber-500"
                          : isPast
                          ? "bg-slate-400"
                          : "bg-[#138872]"
                      }`}
                    />
                  </div>
                </Marker>
              );
            })}

            {/* Destination finale */}
            {nextTrip.destinationLocation && (
              <Marker
                latitude={nextTrip.destinationLocation.lat}
                longitude={nextTrip.destinationLocation.lng}
                anchor="bottom"
              >
                <div className="relative flex flex-col items-center">
                  <div className="px-2 py-0.5 mb-1 rounded-md bg-[#2d6cb5] text-white text-[9px] font-bold shadow-xs whitespace-nowrap">
                    Destination (Église)
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2d6cb5] text-white ring-2 ring-white shadow-md">
                    <Church className="h-4.5 w-4.5 stroke-[2.2]" />
                  </div>
                  <div className="h-2 w-2 rotate-45 bg-[#2d6cb5] -mt-1 ring-1 ring-white" />
                </div>
              </Marker>
            )}
          </>
        ) : isTripImminent && nextTrip?.role === "passenger" ? (
          <>
            {/* 1.2 EN MODE TRAJET IMMINENT / ACTIF PASSAGER : POSITION EN DIRECT DU CONDUCTEUR */}
            {(() => {
              const driverLoc = nextTrip.currentLocation || nextTrip.departureLocation;
              if (!driverLoc) return null;
              const isLive = Boolean(nextTrip.currentLocation || nextTrip.status === "active");

              return (
                <Marker
                  latitude={driverLoc.lat}
                  longitude={driverLoc.lng}
                  anchor="bottom"
                >
                  <div className="relative flex flex-col items-center">
                    <div className="px-2 py-0.5 mb-1 rounded-md bg-[#2d6cb5] text-white text-[9px] font-bold shadow-xs whitespace-nowrap flex items-center gap-1">
                      {isLive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />}
                      <span>{nextTrip.driverName} {isLive ? "(En direct)" : ""}</span>
                    </div>
                    <div className="relative flex items-center justify-center">
                      {isLive && <div className="absolute h-12 w-12 rounded-full bg-[#2d6cb5]/30 animate-ping" />}
                      <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#2d6cb5] text-white ring-2 ring-white shadow-lg">
                        <Car className="h-4.5 w-4.5 stroke-[2.2]" />
                      </div>
                    </div>
                    <div className="h-2 w-2 rotate-45 bg-[#2d6cb5] -mt-1 ring-1 ring-white" />
                  </div>
                </Marker>
              );
            })()}

            {/* Point de prise en charge du passager */}
            {nextTrip.myPickupLocation && (
              <Marker
                latitude={nextTrip.myPickupLocation.lat}
                longitude={nextTrip.myPickupLocation.lng}
                anchor="bottom"
              >
                <div className="relative flex flex-col items-center">
                  <div className="px-2 py-0.5 mb-1 rounded-md bg-[#138872] text-white text-[9px] font-bold shadow-xs whitespace-nowrap">
                    Votre arrêt (Vous)
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#138872] text-white ring-2 ring-white shadow-md">
                    <MapPin className="h-4.5 w-4.5 stroke-[2.2]" />
                  </div>
                  <div className="h-2 w-2 rotate-45 bg-[#138872] -mt-1 ring-1 ring-white" />
                </div>
              </Marker>
            )}

            {/* Destination finale (Église) */}
            {nextTrip.destinationLocation && (
              <Marker
                latitude={nextTrip.destinationLocation.lat}
                longitude={nextTrip.destinationLocation.lng}
                anchor="bottom"
              >
                <div className="relative flex flex-col items-center">
                  <div className="px-2 py-0.5 mb-1 rounded-md bg-[#1a3860] text-white text-[9px] font-bold shadow-xs whitespace-nowrap">
                    Destination (Église)
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a3860] text-white ring-2 ring-white shadow-md">
                    <Church className="h-4.5 w-4.5 stroke-[2.2]" />
                  </div>
                  <div className="h-2 w-2 rotate-45 bg-[#1a3860] -mt-1 ring-1 ring-white" />
                </div>
              </Marker>
            )}
          </>
        ) : (
          <>
            {/* Marqueur Église (Au centre - cercle blanc et église bleu marine #1e3f68) */}
            <Marker
              latitude={churchLocation.lat}
              longitude={churchLocation.lng}
              anchor="center"
            >
              <div className="relative flex items-center justify-center cursor-pointer group">
                {/* Halo lumineux concentrique */}
                <div className="absolute h-20 w-20 rounded-full bg-blue-500/10 pointer-events-none" />
                <div className="relative flex h-13 w-13 items-center justify-center rounded-full bg-white text-[#1e3f68] shadow-xl ring-4 ring-white/95 dark:bg-slate-900 dark:text-white dark:ring-slate-800 transition-transform active:scale-95">
                  <Church className="h-6 w-6 stroke-[2.2] text-[#1e3f68] dark:text-white" />
                </div>
              </div>
            </Marker>

            {/* Marqueur Position Utilisateur (Radar bleu concentrique #3879f4 du template) */}
            <Marker
              latitude={activeUserPos.lat}
              longitude={activeUserPos.lng}
              anchor="center"
            >
              <div className="relative flex items-center justify-center pointer-events-none">
                <div className="absolute h-28 w-28 rounded-full bg-[#3879f4]/15 border border-[#3879f4]/30 animate-ping duration-1000" />
                <div className="absolute h-20 w-20 rounded-full bg-[#3879f4]/15" />
                <div className="absolute h-12 w-12 rounded-full bg-[#3879f4]/25" />
                <div className="relative h-4 w-4 rounded-full bg-[#3879f4] ring-4 ring-white shadow-md" />
              </div>
            </Marker>

            {/* Marqueurs Conducteurs / Trajets (Pins Bleus #2669e2 avec icône voiture) */}
            {visibleTrips.map((trip) => {
              const isSelected = selectedTrip?._id === trip._id;

              return (
                <Marker
                  key={trip._id}
                  latitude={trip.departureLocation.lat}
                  longitude={trip.departureLocation.lng}
                  anchor="bottom"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setSelectedNeed(null);
                    setSelectedTrip(trip);
                  }}
                >
                  <div className="relative flex flex-col items-center cursor-pointer group">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full bg-[#2669e2] text-white shadow-lg ring-2 ring-white transition-all ${
                        isSelected ? "scale-125 ring-4 ring-blue-300 z-30" : "hover:scale-110 active:scale-95 z-10"
                      }`}
                    >
                      <Car className="h-5 w-5 stroke-[2.2]" />
                    </div>
                    <div className="h-2 w-2 rotate-45 bg-[#2669e2] -mt-1 ring-1 ring-white" />
                    {trip.availableSeats > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#268d77] px-1 text-[9px] font-extrabold text-white ring-1 ring-white shadow">
                        {trip.availableSeats}
                      </span>
                    )}
                  </div>
                </Marker>
              );
            })}

            {/* Marqueurs Passagers / Besoins (Pins Vert Émeraude #268d77) */}
            {visibleNeeds.map((need) => {
              const isSelected = selectedNeed?._id === need._id;

              return (
                <Marker
                  key={need._id}
                  latitude={need.pickupLocation.lat}
                  longitude={need.pickupLocation.lng}
                  anchor="bottom"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setSelectedTrip(null);
                    setSelectedNeed(need);
                  }}
                >
                  <div className="relative flex flex-col items-center cursor-pointer group">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full bg-[#268d77] text-white shadow-lg ring-2 ring-white transition-all ${
                        isSelected ? "scale-125 ring-4 ring-emerald-300 z-30" : "hover:scale-110 active:scale-95 z-10"
                      }`}
                    >
                      <MapPin className="h-5 w-5 stroke-[2.2]" />
                    </div>
                    <div className="h-2 w-2 rotate-45 bg-[#268d77] -mt-1 ring-1 ring-white" />
                  </div>
                </Marker>
              );
            })}
          </>
        )}
      </Map>

      {/* BOUTON RECENTRER SUR MA POSITION */}
      <div
        className="absolute right-4 z-20"
        style={{ top: "calc(max(0.75rem, env(safe-area-inset-top, 0.75rem)) + 4.25rem)" }}
      >
        <button
          onClick={() => {
            if (userLocation) {
              setViewState({
                latitude: userLocation.lat,
                longitude: userLocation.lng,
                zoom: 14.5,
              });
            } else {
              requestGeolocation(true);
            }
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-md border border-[#eef2f6] hover:bg-slate-50 active:scale-95 transition-all"
          title="Localiser ma position"
        >
          <LocateFixed className="h-5 w-5 text-[#2e60a8]" />
        </button>
      </div>

      {/* 2. EN-TÊTE SUPÉRIEURE FLOTTANTE : "Autour de moi" + FILTRE (STYLE GLASSY DU TEMPLATE) */}
      <div
        className="absolute inset-x-4 max-w-md mx-auto z-20"
        style={{ top: "max(0.75rem, env(safe-area-inset-top, 0.75rem))" }}
      >
        <div className="flex items-center justify-between rounded-3xl glass-panel px-4 py-3 shadow-[0_8px_30px_rgba(20,40,75,0.06)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e6f4f0] text-[#38917d]">
              <MapPin className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1a3860] leading-tight">
                Autour de moi
              </h2>
              <p className="text-xs text-[#7d8fa5] leading-tight mt-0.5">
                Destination : Église
              </p>
            </div>
          </div>

          {/* Bouton Filtre Circulaire */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu((v) => !v)}
              className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all active:scale-95 ${
                showFilterMenu || filter !== "all"
                  ? "bg-[#e8f1fb] border-blue-200 text-[#2d6cb5]"
                  : "bg-white/80 border-white/80 text-[#5a708a] hover:bg-white"
              }`}
              title="Filtrer la carte"
            >
              <SlidersHorizontal className="h-4 w-4 stroke-[2]" />
            </button>

            {/* Menu Popover filtre rapide */}
            {showFilterMenu && (
              <div className="absolute right-0 top-12 w-44 rounded-2xl bg-white dark:bg-slate-900 p-2 shadow-xl border border-slate-100 dark:border-slate-800 space-y-1 z-30">
                <button
                  onClick={() => {
                    setFilter("all");
                    setShowFilterMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl ${
                    filter === "all"
                      ? "bg-[#e8f1fb] text-[#1f61b4] dark:bg-blue-950 dark:text-blue-400"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span>Tout ({trips.length + needs.length})</span>
                </button>
                <button
                  onClick={() => {
                    setFilter("trips");
                    setShowFilterMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl ${
                    filter === "trips"
                      ? "bg-[#e8f1fb] text-[#1f61b4] dark:bg-blue-950 dark:text-blue-400"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Car className="h-3.5 w-3.5 text-[#2168d9]" /> Voitures
                  </span>
                  <span className="text-[10px] text-slate-400">{trips.length}</span>
                </button>
                <button
                  onClick={() => {
                    setFilter("needs");
                    setShowFilterMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl ${
                    filter === "needs"
                      ? "bg-[#e8f5f1] text-[#138872] dark:bg-emerald-950 dark:text-emerald-400"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#138872]" /> Besoins
                  </span>
                  <span className="text-[10px] text-slate-400">{needs.length}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. FICHE FLOTTANTE DU TEMPLATE (STYLE FROSTED GLASS / VERRE POLI) */}
      <div
        className="fixed left-4 right-4 max-w-md mx-auto z-30"
        style={{ bottom: "max(5.5rem, calc(env(safe-area-inset-bottom, 0px) + 5rem))" }}
      >
        <div className="rounded-[32px] glass-panel p-4 pt-2.5 space-y-3">
          {/* Poignée de tiroir / Grab Bar */}
          <div className="w-10 h-1 bg-slate-300/80 rounded-full mx-auto" />

          {/* DÉTAIL D'UN MARQUEUR SÉLECTIONNÉ (SI CLIC SUR CAR OU NEED) */}
          {selectedTrip && (
            <div className="relative rounded-2xl glass-card p-4 space-y-3">
              <button
                onClick={() => setSelectedTrip(null)}
                className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-200/80 text-slate-600 hover:bg-slate-300"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e6f0fa] text-[#2d6cb5] font-bold text-base">
                  {selectedTrip.driver?.name?.[0] ?? "C"}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-bold text-[#1a3860]">
                      {selectedTrip.driver?.name ?? "Conducteur"}
                    </h3>
                    <VerifiedTicker status={selectedTrip.driver?.status} showText size="xs" />
                  </div>
                  <p className="text-xs text-[#7d8fa5] mt-0.5">
                    Départ : {formatHour(selectedTrip.departureTime)} • {selectedTrip.availableSeats} place(s) dispo
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-600 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-[#2d6cb5] flex-shrink-0" />
                <span className="truncate">{selectedTrip.departureLocation.address}</span>
              </div>

              {onRequestSeat && currentUserId !== selectedTrip.driverId && (
                <button
                  onClick={() => {
                    onRequestSeat(selectedTrip._id);
                    setSelectedTrip(null);
                  }}
                  className="w-full flex items-center justify-center rounded-xl bg-[#2d6cb5] py-3 text-xs font-bold text-white shadow-md shadow-[#2d6cb5]/25 hover:bg-[#255ea0] active:scale-95 transition-all"
                >
                  Demander une place
                </button>
              )}
            </div>
          )}

          {selectedNeed && (
            <div className="relative rounded-2xl glass-card p-4 space-y-3">
              <button
                onClick={() => setSelectedNeed(null)}
                className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-200/80 text-slate-600 hover:bg-slate-300"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e6f4f0] text-[#38917d] font-bold text-base">
                  {selectedNeed.passenger?.name?.[0] ?? "P"}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-bold text-[#1a3860]">
                      {selectedNeed.passenger?.name ?? "Passager"}
                    </h3>
                    <VerifiedTicker status={selectedNeed.passenger?.status} showText size="xs" />
                  </div>
                  <p className="text-xs text-[#38917d] font-medium mt-0.5">
                    Demande {selectedNeed.seatsRequested} place(s)
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-600 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-[#38917d] flex-shrink-0" />
                <span className="truncate">{selectedNeed.pickupLocation.address}</span>
              </div>

              {currentUserId === selectedNeed.passengerId ? (
                <button
                  onClick={() => {
                    router.push(`/requests/${selectedNeed._id}`);
                    setSelectedNeed(null);
                  }}
                  className="w-full flex items-center justify-center rounded-xl bg-[#175276] py-3 text-xs font-bold text-white shadow-md shadow-[#175276]/25 hover:bg-[#134260] active:scale-95 transition-all"
                >
                  Voir ma demande
                </button>
              ) : onPickUpNeed ? (
                <button
                  onClick={() => {
                    onPickUpNeed(selectedNeed._id);
                    setSelectedNeed(null);
                  }}
                  className="w-full flex items-center justify-center rounded-xl bg-[#38917d] py-3 text-xs font-bold text-white shadow-md shadow-[#38917d]/25 hover:bg-[#2e7d6b] active:scale-95 transition-all"
                >
                  Proposer de le récupérer
                </button>
              ) : null}
            </div>
          )}

          {/* MODE TRAJET IMMINENT (<= 5 min) : REMPLACE LES 2 BOUTONS ET LA PREVIEW */}
          {!selectedTrip && !selectedNeed && isTripImminent && nextTrip ? (
            <div className="rounded-3xl glass-card bg-white/95 backdrop-blur-2xl p-4 border border-white/80 shadow-[0_12px_36px_rgba(20,40,75,0.14)] space-y-3.5 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* En-tête : Titre du trajet + Décompte temps réel */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[#e6f0fa] text-[#2d6cb5] shadow-xs">
                    <Car className="h-5 w-5 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[#1a3860] truncate">
                        {nextTrip.title || "Trajet vers l'église"}
                      </h4>
                      <span className="flex-shrink-0 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-[#138872] border border-emerald-200">
                        {nextTrip.role === "driver" ? "Conducteur" : "Passager"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Départ à <span className="font-semibold text-slate-700">{formatHour(nextTrip.departureTime)}</span>
                    </p>
                  </div>
                </div>

                {/* Décompte à côté du trajet */}
                <div className="flex-shrink-0">
                  {countdown.isPast ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black shadow-xs animate-pulse">
                      <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                      <span>Départ !</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200/90 text-amber-800 text-xs font-black shadow-xs">
                      <Clock className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                      <span>Dans {countdown.text}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section Conducteur : Soit en cours (Active) avec prochaine escale et bouton appeler, soit planifié */}
              {nextTrip.role === "driver" ? (
                nextTrip.status === "active" ? (
                  /* 1. CONDUCTEUR EN ROUTE (TRAJET ACTIF) : PROCHAINE ESCALE + BOUTON APPELER JUSQU'À L'ÉGLISE */
                  <div className="space-y-3">
                    {!isAllEscalesDone && currentEscale ? (
                      <div className="rounded-2xl bg-gradient-to-r from-teal-50/90 to-blue-50/90 border border-[#138872]/30 p-3.5 space-y-2.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#138872] flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                            Prochaine escale ({currentEscaleIndex + 1}/{optimalEscales.length})
                          </span>
                          <button
                            onClick={() => setShowGpsChooser(true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[10px] font-extrabold shadow-2xs active:scale-95 transition-all"
                          >
                            <Navigation className="h-3 w-3 text-[#2d6cb5]" />
                            <span>GPS</span>
                          </button>
                        </div>

                        {/* Fiche Passager avec logo / bouton pour appeler la personne */}
                        <div className="flex items-center justify-between gap-3 bg-white/95 p-3 rounded-2xl border border-white/90 shadow-xs">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e6f4f0] text-[#138872] font-black text-sm flex-shrink-0">
                              {currentEscale.passengerName?.[0] || "P"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-sm font-bold text-[#1a3860] truncate">
                                  {currentEscale.passengerName}
                                </h4>
                                <VerifiedTicker status={currentEscale.passengerStatus} />
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                <MapPin className="h-3 w-3 text-[#138872] flex-shrink-0" />
                                <span className="truncate">{currentEscale.pickupLocation.address}</span>
                              </div>
                            </div>
                          </div>

                          {/* BOUTON AVEC LE LOGO POUR APPELER LA PERSONNE DIRECTEMENT */}
                          {currentEscale.passengerPhone ? (
                            <a
                              href={`tel:${currentEscale.passengerPhone}`}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#138872] hover:bg-[#0f6c5b] text-white text-xs font-bold shadow-md shadow-[#138872]/20 active:scale-95 transition-all flex-shrink-0"
                              title={`Appeler ${currentEscale.passengerName}`}
                            >
                              <Phone className="h-3.5 w-3.5 fill-white" />
                              <span>Appeler</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Pas de tél</span>
                          )}
                        </div>

                        {/* Bouton pour valider la prise en charge et passer à la prochaine étape */}
                        <button
                          onClick={handleAdvanceEscale}
                          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] hover:opacity-95 active:scale-98 text-white font-extrabold text-xs shadow-md shadow-[#1b7f80]/20 transition-all cursor-pointer"
                        >
                          <Check className="h-4 w-4 stroke-[3]" />
                          <span>Passager récupéré (Étape suivante)</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      /* En route vers la destination finale (Église) */
                      <div className="rounded-2xl bg-gradient-to-r from-blue-50/90 to-teal-50/90 border border-[#2d6cb5]/30 p-3.5 space-y-2.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#2d6cb5] flex items-center gap-1.5">
                            <Church className="h-3.5 w-3.5 text-[#2d6cb5]" />
                            Destination finale
                          </span>
                          <button
                            onClick={() => setShowGpsChooser(true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[10px] font-extrabold shadow-2xs active:scale-95 transition-all"
                          >
                            <Navigation className="h-3 w-3 text-[#2d6cb5]" />
                            <span>GPS</span>
                          </button>
                        </div>

                        <div className="bg-white/95 p-3 rounded-2xl border border-white/90 space-y-1">
                          <p className="text-xs font-bold text-[#1a3860]">
                            {optimalEscales.length > 0
                              ? "Tous les passagers sont à bord ! Direction l'église."
                              : "Trajet direct en cours vers l'église."}
                          </p>
                          <p className="text-xs text-slate-600 truncate flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-[#2d6cb5] flex-shrink-0" />
                            <span>{nextTrip.destinationLocation?.address || churchLocation.address}</span>
                          </p>
                        </div>

                        <button
                          onClick={handleCompleteTrip}
                          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-[#138872] to-[#2d6cb5] hover:opacity-95 active:scale-98 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
                        >
                          <Check className="h-4 w-4 stroke-[3]" />
                          <span>Terminer le trajet (Arrivé à destination)</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 2. TRAJET PLANIFIÉ (PAS ENCORE LANCÉ) : VUE RÉCAPITULATIVE ET BOUTON Y ALLER */
                  <div className="space-y-2.5">
                    <div className="rounded-2xl bg-slate-50/90 border border-slate-200/70 p-3 max-h-44 overflow-y-auto space-y-2.5 text-xs">
                      {/* 1. Point de départ */}
                      <div className="flex items-start gap-2.5">
                        <div className="flex flex-col items-center">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a3860] text-white text-[10px] font-bold">
                            D
                          </div>
                          <div className="w-0.5 h-6 bg-slate-300 my-0.5" />
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="font-bold text-[#1a3860] text-[11px] uppercase tracking-wide">
                            Point de départ
                          </p>
                          <p className="text-slate-600 text-xs truncate">
                            {nextTrip.departureLocation?.address || "Votre position"}
                          </p>
                        </div>
                      </div>

                      {/* 2. Escales ordonnées pour le meilleur parcours */}
                      {optimalEscales.length > 0 ? (
                        optimalEscales.map((escale, idx) => (
                          <div key={escale.requestId} className="flex items-start gap-2.5">
                            <div className="flex flex-col items-center">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#138872] text-white text-[10px] font-extrabold shadow-xs">
                                {idx + 1}
                              </div>
                              <div className="w-0.5 h-6 bg-slate-300 my-0.5" />
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <div className="flex items-center justify-between gap-1">
                                <p className="font-bold text-[#138872] text-[11px] truncate">
                                  Escale {idx + 1} : {escale.passengerName}
                                </p>
                                <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                  {escale.seatsRequested} pl.
                                </span>
                              </div>
                              <p className="text-slate-600 text-xs truncate mt-0.5">
                                {escale.pickupLocation.address}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-start gap-2.5">
                          <div className="flex flex-col items-center">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-300 text-slate-600 text-[10px] font-bold">
                              —
                            </div>
                            <div className="w-0.5 h-4 bg-slate-200 my-0.5" />
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p className="text-[11px] font-medium text-slate-500 italic">
                              Direct sans escale (aucun passager pour l'instant)
                            </p>
                          </div>
                        </div>
                      )}

                      {/* 3. Destination finale */}
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2d6cb5] text-white text-[10px] font-bold">
                          <Church className="h-3 w-3" />
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="font-bold text-[#2d6cb5] text-[11px] uppercase tracking-wide">
                            Destination (Église)
                          </p>
                          <p className="text-slate-600 text-xs truncate">
                            {nextTrip.destinationLocation?.address || churchLocation.address}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bouton "Y aller" pour lancer le trajet et le choix du GPS */}
                    <button
                      onClick={handleDriverGoClick}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2d6cb5] to-[#138872] hover:from-[#255ea0] hover:to-[#0f6c5b] active:scale-98 text-white font-extrabold py-3.5 px-4 text-sm shadow-[0_8px_20px_rgba(45,108,181,0.28)] transition-all cursor-pointer"
                    >
                      <Navigation className="h-4 w-4 fill-white" />
                      <span>Y aller</span>
                    </button>
                  </div>
                )
              ) : (
                /* Section Passager : Suivi en direct du conducteur et de sa prochaine destination */
                <div className="space-y-3">
                  {/* Bannière "Prochaine destination du conducteur" */}
                  <div className="rounded-2xl bg-gradient-to-r from-blue-50/90 to-teal-50/90 border border-blue-200/80 p-3.5 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#2d6cb5] flex items-center gap-1.5">
                        <Compass className="h-3.5 w-3.5 text-[#2d6cb5]" />
                        Prochaine destination du conducteur
                      </span>
                      {nextTrip.status === "active" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-[#138872] text-[10px] font-bold">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                          En route
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-500">
                          Départ imminent
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm font-bold text-[#1a3860] flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#138872] flex-shrink-0" />
                      <span className="truncate">{driverNextDestination}</span>
                    </p>

                    {/* Distance et estimation de temps si calculable */}
                    {passengerDistanceInfo && (
                      <div className="pt-1.5 border-t border-blue-100/70 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Distance jusqu'à vous :</span>
                        <span className="font-extrabold text-[#1a3860]">
                          {passengerDistanceInfo.distStr} (~{passengerDistanceInfo.estMin} min)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Récapitulatif : Conducteur & Prise en charge */}
                  <div className="rounded-2xl bg-slate-50/90 border border-slate-200/70 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Conducteur</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">{nextTrip.driverName}</span>
                        <VerifiedTicker status={nextTrip.driverStatus} />
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-500 flex-shrink-0">Votre prise en charge</span>
                      <span className="font-medium text-slate-800 text-right truncate">
                        {nextTrip.myPickupLocation?.address || "Lieu convenu"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-500 flex-shrink-0">Destination</span>
                      <span className="font-medium text-slate-800 text-right truncate">
                        {nextTrip.destinationLocation?.address || churchLocation.address}
                      </span>
                    </div>
                  </div>

                  {/* Boutons d'action : Appeler le conducteur & Lancer GPS vers son arrêt */}
                  <div className="flex items-center gap-2 pt-0.5">
                    {nextTrip.driverPhone && (
                      <a
                        href={`tel:${nextTrip.driverPhone}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-3.5 px-3 rounded-2xl bg-[#138872] hover:bg-[#0f6c5b] text-white text-xs font-bold shadow-md shadow-[#138872]/20 active:scale-95 transition-all text-center"
                      >
                        <Phone className="h-4 w-4 fill-white" />
                        <span>Appeler</span>
                      </a>
                    )}
                    <button
                      onClick={() => setShowGpsChooser(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3.5 px-3 rounded-2xl bg-gradient-to-r from-[#2d6cb5] to-[#138872] hover:opacity-95 text-white text-xs font-bold shadow-md shadow-[#2d6cb5]/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <Navigation className="h-4 w-4 fill-white" />
                      <span>Y aller (GPS)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* LA CARTE "TRAJET VERS L'ÉGLISE" : AFFICHÉE UNIQUEMENT S'IL Y A UN PROCHAIN TRAJET NON IMMINENT */}
              {!selectedTrip && !selectedNeed && nextTrip && (
                <div
                  onClick={() => router.push(nextTrip.role === "driver" ? `/trips/${nextTrip._id}` : "/trips")}
                  className="group flex items-center justify-between rounded-2xl glass-card p-3.5 hover:bg-white/95 transition-all cursor-pointer shadow-sm hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#e6f0fa] text-[#2d6cb5]">
                      <Car className="h-6 w-6 stroke-[2]" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-[#207567] truncate">
                        {nextTrip.title || "Trajet vers l'église"}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium truncate">
                        Départ • {formatHour(nextTrip.departureTime)} • {nextTrip.availableSeats} place(s)
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-normal">
                        {nextTrip.role === "passenger"
                          ? `Conducteur : ${nextTrip.driverName}`
                          : distanceInfo}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </div>
              )}

              {/* LES 2 BOUTONS D'ACTION DU TEMPLATE (UNIQUEMENT HORS MODE IMMINENT) */}
              {!selectedTrip && !selectedNeed && (
                <div className="flex items-center gap-2.5 pt-0.5">
                  {/* Proposer un trajet (Bleu océanique #2d6cb5) */}
                  <button
                    onClick={() => onCreateTripClick?.(userLocation || undefined)}
                    className="flex-1 flex items-center justify-center rounded-2xl bg-[#2d6cb5] hover:bg-[#255ea0] active:scale-95 text-white font-bold py-3.5 px-3 text-xs sm:text-sm shadow-[0_8px_20px_rgba(45,108,181,0.28)] transition-all text-center"
                  >
                    Proposer un trajet
                  </button>

                  {/* Besoin d'un trajet (Vert émeraude #38917d) */}
                  <button
                    onClick={() => onSignalNeedClick?.(userLocation || undefined)}
                    className="flex-1 flex items-center justify-center rounded-2xl bg-[#38917d] hover:bg-[#2e7d6b] active:scale-95 text-white font-bold py-3.5 px-3 text-xs sm:text-sm shadow-[0_8px_20px_rgba(56,145,125,0.28)] transition-all text-center"
                  >
                    Besoin d'un trajet
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODALE DE CHOIX GPS (APPROCHE HYBRIDE : GOOGLE MAPS / WAZE / APPLE PLANS / SUIVI IN-APP) */}
      {nextTrip && (
        <GpsChooserModal
          isOpen={showGpsChooser}
          onClose={() => setShowGpsChooser(false)}
          origin={
            nextTrip.role === "passenger" && nextTrip.myPickupLocation
              ? nextTrip.myPickupLocation
              : nextTrip.currentLocation || nextTrip.departureLocation || {
                  lat: activeUserPos.lat,
                  lng: activeUserPos.lng,
                  address: "Ma position",
                }
          }
          destination={nextTrip.destinationLocation || churchLocation}
          waypoints={
            nextTrip.role === "driver"
              ? optimalEscales.slice(currentEscaleIndex).map((e) => ({
                  lat: e.pickupLocation.lat,
                  lng: e.pickupLocation.lng,
                  address: e.pickupLocation.address,
                  name: e.passengerName,
                }))
              : []
          }
          tripId={nextTrip._id}
        />
      )}
    </div>
  );
};