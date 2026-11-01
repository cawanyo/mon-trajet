"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { AddressAutocompleteInput } from "@/components/ui/AddressAutocompleteInput";
import { reverseGeocode, geocodeAddress, estimateRouteDurations } from "@/lib/geo";
import { useToast } from "@/components/ui/ToastProvider";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Car,
  MapPin,
  Clock,
  Calendar,
  Compass,
  ArrowLeft,
  ArrowRight,
  Loader2,
  LocateFixed,
  Church,
  RotateCcw,
  Plus,
  Trash2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

interface TripStopItem {
  id: string;
  address: string;
  lat: number;
  lng: number;
}

// Calcul de l'heure résultante : "09:00" + 15 min = "09:15"
function getEstimatedStopTimeStr(baseTimeStr: string, minutesToAdd: number): string {
  const [h, m] = baseTimeStr.split(":").map(Number);
  const totalMin = (h || 0) * 60 + (m || 0) + minutesToAdd;
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function CreateTripContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  // Étape courante : 1 = Carte & Itinéraire, 2 = Horaires & Places
  const [step, setStep] = useState<1 | 2>(1);

  // Référence à la carte MapLibre
  const mapRef = useRef<any>(null);

  // Récupération des paramètres de l'église
  const churchSettings = useQuery(api.settings.getChurchSettings);
  const createTrip = useMutation(api.trips.createTrip);

  // Lieu de départ
  const [departureAddress, setDepartureAddress] = useState("");
  const [departureCoords, setDepartureCoords] = useState<{ lat: number; lng: number }>({
    lat: 48.8566,
    lng: 2.3522,
  });

  // Arrêts intermédiaires / étapes
  const [stops, setStops] = useState<TripStopItem[]>([]);

  // Lieu de destination (initialisé à l'église une seule fois)
  const [destinationAddress, setDestinationAddress] = useState("");
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number }>({
    lat: 48.8566,
    lng: 2.3522,
  });

  // Flag pour ne charger l'église par défaut qu'une seule fois
  const hasInitializedChurchRef = useRef(false);

  // Date et Heure par défaut
  const getNowStrings = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return {
      dateStr: `${year}-${month}-${day}`,
      timeStr: `${hours}:${minutes}`,
    };
  };

  const initialDateTime = getNowStrings();
  const [todayStr, setTodayStr] = useState(initialDateTime.dateStr);
  const [date, setDate] = useState(initialDateTime.dateStr);
  const [time, setTime] = useState(initialDateTime.timeStr);

  // Nombre de places
  const [seats, setSeats] = useState(3);

  // Périmètre toléré (200 m à 5 km, défaut: 500 m)
  const [radiusMeters, setRadiusMeters] = useState(500);

  // Initialisation du détour par défaut depuis les préférences
  useEffect(() => {
    if (user && (user as any).preferences?.preferredDetourRadius) {
      setRadiusMeters((user as any).preferences.preferredDetourRadius);
    }
  }, [user]);

  // Pré-remplissage avec l'adresse du domicile si configurée
  useEffect(() => {
    if (user && (user as any).homeAddress?.address && !departureAddress && !searchParams.get("lat")) {
      const home = (user as any).homeAddress;
      setDepartureAddress(home.address);
      if (home.lat && home.lng) {
        setDepartureCoords({ lat: home.lat, lng: home.lng });
      }
    }
  }, [user, departureAddress, searchParams]);

  const [notes, setNotes] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialisation de l'état de la vue de la carte
  const [viewState, setViewState] = useState({
    latitude: 48.8566,
    longitude: 2.3522,
    zoom: 13,
  });

  // Initialisation avec l'église
  useEffect(() => {
    if (churchSettings && !hasInitializedChurchRef.current) {
      hasInitializedChurchRef.current = true;
      if (!destinationAddress) {
        setDestinationAddress(churchSettings.address);
        setDestinationCoords({
          lat: churchSettings.lat,
          lng: churchSettings.lng,
        });
        setViewState((prev) => ({
          ...prev,
          latitude: churchSettings.lat,
          longitude: churchSettings.lng,
        }));
      }
    }
  }, [churchSettings, destinationAddress]);

  // Coordonnées GPS passées dans l'URL
  useEffect(() => {
    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");
    if (latParam && lngParam && !departureAddress) {
      const parsedLat = parseFloat(latParam);
      const parsedLng = parseFloat(lngParam);
      setDepartureCoords({ lat: parsedLat, lng: parsedLng });
      reverseGeocode(parsedLat, parsedLng).then((addr) => setDepartureAddress(addr));
    }
  }, [searchParams]);

  // Formatage du rayon pour l'affichage
  const formatRadius = (meters: number) => {
    if (meters < 1000) return `${meters} m`;
    const km = meters / 1000;
    return `${km % 1 === 0 ? km : km.toFixed(1).replace(".", ",")} km`;
  };

  // Filtrer les arrêts valides ayant des coordonnées réelles
  const validStops = useMemo(() => {
    return stops.filter((s) => s.address.trim() && s.lat && s.lng);
  }, [stops]);

  // Points ordonnés complets du trajet : Départ -> Arrêt 1 -> Arrêt 2 -> ... -> Destination
  const routePoints = useMemo(() => {
    if (!departureCoords?.lat || !departureCoords?.lng) return [];
    const pts = [{ lat: departureCoords.lat, lng: departureCoords.lng }];
    for (const s of validStops) {
      pts.push({ lat: s.lat, lng: s.lng });
    }
    if (destinationCoords?.lat && destinationCoords?.lng && destinationAddress.trim()) {
      pts.push({ lat: destinationCoords.lat, lng: destinationCoords.lng });
    }
    return pts;
  }, [departureCoords, validStops, destinationCoords, destinationAddress]);

  // Estimations des durées et distances cumulées pour chaque étape
  const routeEstimations = useMemo(() => {
    return estimateRouteDurations(routePoints);
  }, [routePoints]);

  // Ajuste la vue de la carte pour afficher l'ensemble des points (départ, arrêts, arrivée)
  const fitRouteBounds = () => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap ? mapRef.current.getMap() : mapRef.current;
    if (!map) return;

    const allPts: Array<{ lat: number; lng: number }> = [];
    if (departureCoords?.lat) allPts.push(departureCoords);
    for (const s of validStops) {
      if (s.lat && s.lng) allPts.push({ lat: s.lat, lng: s.lng });
    }
    if (destinationAddress.trim() && destinationCoords?.lat) allPts.push(destinationCoords);

    if (allPts.length === 0) return;
    if (allPts.length === 1) {
      map.easeTo({ center: [allPts[0].lng, allPts[0].lat], zoom: 14, duration: 800 });
      return;
    }

    const minLng = Math.min(...allPts.map((p) => p.lng));
    const maxLng = Math.max(...allPts.map((p) => p.lng));
    const minLat = Math.min(...allPts.map((p) => p.lat));
    const maxLat = Math.max(...allPts.map((p) => p.lat));

    try {
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        {
          padding: { top: 90, bottom: 380, left: 50, right: 50 },
          duration: 800,
          maxZoom: 16,
        }
      );
    } catch (err) {
      console.warn("fitRouteBounds ignoré :", err);
    }
  };

  // Gestion des arrêts intermédiaires
  const handleAddStop = () => {
    if (stops.length >= 5) {
      toast.info("Maximum 5 arrêts intermédiaires par trajet.");
      return;
    }
    setStops((prev) => [
      ...prev,
      { id: Math.random().toString(36).substring(2, 9), address: "", lat: 0, lng: 0 },
    ]);
  };

  const handleRemoveStop = (id: string) => {
    setStops((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateStop = (id: string, address: string, coords?: { lat: number; lng: number }) => {
    setStops((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        return {
          ...s,
          address,
          lat: coords?.lat ?? s.lat,
          lng: coords?.lng ?? s.lng,
        };
      })
    );
  };

  // Détection position actuelle du conducteur
  const handleDetectCurrentLocation = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      toast.error("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }

    setIsLocating(true);

    const applyLocation = async (lat: number, lng: number) => {
      const newCoords = { lat, lng };
      setDepartureCoords(newCoords);
      setIsLocating(false);

      if (mapRef.current) {
        const map = mapRef.current.getMap ? mapRef.current.getMap() : mapRef.current;
        if (map) {
          map.easeTo({ center: [lng, lat], zoom: 14, duration: 800 });
        }
      }

      try {
        const realAddr = await reverseGeocode(lat, lng);
        setDepartureAddress(realAddr);
      } catch {}
      fitRouteBounds();
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => applyLocation(pos.coords.latitude, pos.coords.longitude),
      (err1) => {
        if (err1.code === 1) {
          setIsLocating(false);
          toast.error("Emplacement refusé par votre navigateur.");
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => applyLocation(pos.coords.latitude, pos.coords.longitude),
          () => {
            setIsLocating(false);
            toast.error("Impossible d'accéder au GPS. Veuillez saisir votre adresse.");
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  };

  // Réinitialiser la destination vers l'église
  const handleResetToChurch = () => {
    if (churchSettings) {
      setDestinationAddress(churchSettings.address);
      setDestinationCoords({
        lat: churchSettings.lat,
        lng: churchSettings.lng,
      });
      fitRouteBounds();
    }
  };

  // Cercle de détour toléré
  const circleGeoJSON = useMemo(() => {
    if (!departureCoords?.lat || !departureCoords?.lng) return null;
    const points = 64;
    const coords: [number, number][] = [];
    const km = radiusMeters / 1000;
    const distanceX = km / (111.32 * Math.cos((departureCoords.lat * Math.PI) / 180));
    const distanceY = km / 110.574;

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);
      coords.push([departureCoords.lng + x, departureCoords.lat + y]);
    }
    coords.push(coords[0]);

    return {
      type: "Feature" as const,
      geometry: {
        type: "Polygon" as const,
        coordinates: [coords],
      },
      properties: {},
    };
  }, [departureCoords.lat, departureCoords.lng, radiusMeters]);

  // Ligne GeoJSON reliant départ -> tous les arrêts -> destination
  const routeLineGeoJSON = useMemo(() => {
    if (!departureCoords?.lat || !destinationCoords?.lat || !destinationAddress.trim()) return null;

    const coords: [number, number][] = [
      [departureCoords.lng, departureCoords.lat],
      ...validStops.map((s) => [s.lng, s.lat] as [number, number]),
      [destinationCoords.lng, destinationCoords.lat],
    ];

    return {
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: coords,
      },
      properties: {},
    };
  }, [departureCoords, destinationCoords, destinationAddress, validStops]);

  // Mise à jour des calques MapLibre
  const updateMapLayers = () => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap ? mapRef.current.getMap() : mapRef.current;
    if (!map || typeof map.isStyleLoaded !== "function" || !map.isStyleLoaded()) return;

    try {
      // 1. Cercle de détour toléré
      if (circleGeoJSON) {
        const circleSource = map.getSource("detour-circle-source");
        if (circleSource) {
          (circleSource as any).setData(circleGeoJSON);
        } else {
          map.addSource("detour-circle-source", {
            type: "geojson",
            data: circleGeoJSON,
          });
        }

        if (!map.getLayer("detour-circle-fill")) {
          map.addLayer({
            id: "detour-circle-fill",
            type: "fill",
            source: "detour-circle-source",
            paint: {
              "fill-color": "#268d77",
              "fill-opacity": 0.22,
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
              "line-width": 2.5,
              "line-dasharray": [3, 2],
            },
          });
        }
      }

      // 2. Ligne reliant départ, arrêts et destination
      if (routeLineGeoJSON && destinationAddress.trim()) {
        const lineSource = map.getSource("route-line-source");
        if (lineSource) {
          (lineSource as any).setData(routeLineGeoJSON);
        } else {
          map.addSource("route-line-source", {
            type: "geojson",
            data: routeLineGeoJSON,
          });
        }

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
              "line-color": "#2d6cb5",
              "line-width": 3.5,
              "line-dasharray": [2, 1.5],
            },
          });
        }
      } else {
        const lineSource = map.getSource("route-line-source");
        if (lineSource) {
          (lineSource as any).setData({
            type: "FeatureCollection",
            features: [],
          });
        }
      }
    } catch (e) {
      console.log("Erreur mise à jour couches MapLibre :", e);
    }
  };

  useEffect(() => {
    updateMapLayers();
  }, [circleGeoJSON, routeLineGeoJSON, destinationAddress]);

  // Passage à l'étape 2 (Validation des lieux)
  const handleGoToStep2 = async () => {
    if (!departureAddress.trim()) {
      toast.error("Veuillez renseigner un lieu de départ.");
      return;
    }
    if (!destinationAddress.trim()) {
      toast.error("Veuillez renseigner un lieu de destination.");
      return;
    }

    // Géocodage de sécurité
    let depCoords = departureCoords;
    let destCoords = destinationCoords;

    const geocodedDep = await geocodeAddress(departureAddress);
    if (geocodedDep) {
      depCoords = geocodedDep;
      setDepartureCoords(geocodedDep);
    }

    const geocodedDest = await geocodeAddress(destinationAddress);
    if (geocodedDest) {
      destCoords = geocodedDest;
      setDestinationCoords(geocodedDest);
    }

    // Géocodage des arrêts qui n'ont pas encore de coordonnées GPS
    for (const stop of stops) {
      if (stop.address.trim() && (!stop.lat || !stop.lng)) {
        const gStop = await geocodeAddress(stop.address);
        if (gStop) {
          handleUpdateStop(stop.id, stop.address, gStop);
        }
      }
    }

    fitRouteBounds();

    // Actualiser l'heure
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    setTime(`${hours}:${minutes}`);

    setStep(2);
  };

  // Soumission finale du trajet
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!date) {
      toast.error("Veuillez sélectionner la date du trajet.");
      return;
    }

    if (!time) {
      toast.error("Veuillez sélectionner l'heure de départ.");
      return;
    }

    setIsSubmitting(true);
    try {
      const [year, month, day] = date.split("-").map(Number);
      const [hours, minutes] = time.split(":").map(Number);
      const departureDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
      const baseDepartureTime = departureDate.getTime();

      // Formater les arrêts intermédiaires avec leur heure de passage estimée
      const formattedStops = validStops.map((stop, index) => {
        const est = routeEstimations[index];
        const durationMin = est?.cumulativeDurationMinutes ?? (index + 1) * 10;
        const estimatedTime = baseDepartureTime + durationMin * 60 * 1000;

        return {
          lat: stop.lat,
          lng: stop.lng,
          address: stop.address,
          stopOrder: index + 1,
          durationFromDepartureMinutes: durationMin,
          distanceFromDepartureMeters: est?.cumulativeDistanceMeters ?? 0,
          estimatedTime,
        };
      });

      const tripId = await createTrip({
        token,
        departureLocation: {
          lat: departureCoords.lat,
          lng: departureCoords.lng,
          address: departureAddress,
        },
        destinationLocation: {
          lat: destinationCoords.lat,
          lng: destinationCoords.lng,
          address: destinationAddress,
        },
        departureTime: baseDepartureTime,
        totalSeats: seats,
        pickupRadiusMeters: radiusMeters,
        stops: formattedStops.length > 0 ? formattedStops : undefined,
        notes: notes.trim() || undefined,
      });

      router.push(`/trips/success?id=${tripId}`);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création du trajet");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. GARDE DE SÉCURITÉ : SEULS LES MEMBRES VALIDÉS PEUVENT PROPOSER UN TRAJET
  if (!isAuthLoading && user && user.status !== "approved") {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-[#f4f7fb] select-none">
        <div className="max-w-sm w-full rounded-3xl glass-panel bg-white/95 backdrop-blur-2xl p-6 border border-white shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mx-auto border border-amber-200/80 shadow-xs">
            <Clock className="h-7 w-7" />
          </div>

          <div>
            <h1 className="text-base font-bold text-[#1a3860]">
              Compte en attente de validation
            </h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Pour assurer la sécurité et la sérénité de la communauté, seuls les membres vérifiés et validés par les responsables de la paroisse peuvent proposer des trajets de covoiturage.
            </p>
            <div className="mt-3 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/50 text-[11px] text-amber-800 font-semibold leading-snug">
              Votre compte est actuellement en cours d'examen. Vous serez averti dès que votre accès sera activé.
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-full py-3 rounded-2xl bg-[#175276] text-white text-xs font-bold shadow-xs hover:bg-[#134260] active:scale-95 transition-all cursor-pointer"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh bg-[#f4f7fb] text-slate-800 select-none overflow-hidden">
      {/* ============================================================ */}
      {/* ÉTAPE 1 : CARTE INTERACTIVE, DÉPART, ARRÊTS & DESTINATION     */}
      {/* ============================================================ */}
      {step === 1 && (
        <div className="relative h-dvh w-full overflow-hidden bg-slate-100">
          {/* CARTE PLEIN ÉCRAN */}
          <Map
            ref={mapRef}
            {...viewState}
            onMove={(evt) => setViewState(evt.viewState)}
            onLoad={() => {
              setTimeout(() => {
                updateMapLayers();
                fitRouteBounds();
              }, 100);
            }}
            onIdle={updateMapLayers}
            mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
            style={{ width: "100%", height: "100%" }}
            attributionControl={false}
          >
            <NavigationControl position="top-right" />

            {/* Marqueur Départ (Voiture Bleue #2d6cb5) */}
            {departureCoords && (
              <Marker latitude={departureCoords.lat} longitude={departureCoords.lng} anchor="bottom">
                <div className="relative flex flex-col items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2d6cb5] text-white shadow-xl ring-3 ring-white animate-in zoom-in-75 duration-200">
                    <Car className="h-5 w-5 stroke-[2.2]" />
                  </div>
                  <div className="h-2 w-2 rotate-45 bg-[#2d6cb5] -mt-1 ring-1 ring-white" />
                  <span className="mt-1 px-2 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-[10px] font-bold text-[#1a3860] shadow-sm border border-slate-200/60 whitespace-nowrap">
                    Départ
                  </span>
                </div>
              </Marker>
            )}

            {/* Marqueurs des Arrêts Intermédiaires (Pastille Orange/Ambre numérotée) */}
            {validStops.map((stop, index) => (
              <Marker key={stop.id} latitude={stop.lat} longitude={stop.lng} anchor="bottom">
                <div className="relative flex flex-col items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white font-black text-xs shadow-xl ring-3 ring-white animate-in zoom-in-75 duration-200">
                    {index + 1}
                  </div>
                  <div className="h-2 w-2 rotate-45 bg-amber-500 -mt-1 ring-1 ring-white" />
                  <span className="mt-1 px-2 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-[10px] font-bold text-amber-900 shadow-sm border border-amber-200/60 whitespace-nowrap">
                    Arrêt {index + 1}
                  </span>
                </div>
              </Marker>
            ))}

            {/* Marqueur Destination (Église / Arrivée #38917d) */}
            {destinationAddress.trim() && destinationCoords && (
              <Marker latitude={destinationCoords.lat} longitude={destinationCoords.lng} anchor="bottom">
                <div className="relative flex flex-col items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#38917d] text-white shadow-xl ring-3 ring-white animate-in zoom-in-75 duration-200">
                    <Church className="h-5 w-5 stroke-[2.2]" />
                  </div>
                  <div className="h-2 w-2 rotate-45 bg-[#38917d] -mt-1 ring-1 ring-white" />
                  <span className="mt-1 px-2 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-[10px] font-bold text-[#1a3860] shadow-sm border border-slate-200/60 whitespace-nowrap">
                    Arrivée
                  </span>
                </div>
              </Marker>
            )}
          </Map>

          {/* BARRE SUPÉRIEURE FLOTTANTE GLASSY */}
          <div
            className="absolute inset-x-3 max-w-md mx-auto z-20"
            style={{ top: "max(0.75rem, env(safe-area-inset-top, 0.75rem))" }}
          >
            <div className="flex items-center justify-between glass-panel rounded-3xl px-3.5 py-2.5 shadow-lg border border-white/80">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex h-9 w-9 items-center justify-center rounded-2xl glass-card bg-white/80 hover:bg-white text-slate-700 border border-white/80 active:scale-95 transition-all shadow-xs"
                  title="Retour"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h1 className="text-sm font-bold text-[#1a3860] leading-tight">
                    Proposer un trajet
                  </h1>
                  <span className="text-[11px] font-semibold text-[#2d6cb5]">Étape 1 sur 2</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => fitRouteBounds()}
                className="flex h-9 w-9 items-center justify-center rounded-2xl glass-card bg-white/80 hover:bg-white text-[#2d6cb5] border border-white/80 shadow-xs active:scale-95 transition-all"
                title="Centrer l'itinéraire"
              >
                <LocateFixed className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* TIROIR FLOTTANT INFÉRIEUR (DÉPART, ARRÊTS, DESTINATION, DÉTOUR, CONTINUER) */}
          <div
            className="absolute inset-x-3 max-w-md mx-auto z-20"
            style={{ bottom: "max(0.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))" }}
          >
            <div className="glass-panel rounded-3xl p-4 shadow-2xl border border-white/80 space-y-3 max-h-[75vh] overflow-y-auto">
              {/* 1. Lieu de départ */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1a3860]">Départ</span>
                  <button
                    type="button"
                    onClick={handleDetectCurrentLocation}
                    disabled={isLocating}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-bold text-[#2d6cb5] active:scale-95 transition-all shadow-xs"
                  >
                    {isLocating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LocateFixed className="h-3.5 w-3.5" />
                    )}
                    <span>Position GPS</span>
                  </button>
                </div>

                <AddressAutocompleteInput
                  required
                  value={departureAddress}
                  dropdownPosition="top"
                  onChange={(addr, coords) => {
                    setDepartureAddress(addr);
                    if (coords) {
                      setDepartureCoords(coords);
                      fitRouteBounds();
                    }
                  }}
                  placeholder="Adresse de départ..."
                  icon={MapPin}
                  iconColor="text-[#2d6cb5]"
                />
              </div>

              {/* 2. Arrêts intermédiaires / étapes */}
              <div className="space-y-2 pt-1 border-t border-slate-200/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#1a3860]">
                      Arrêts intermédiaires {stops.length > 0 && `(${stops.length})`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Optionnel</span>
                  </div>

                  {stops.length < 5 && (
                    <button
                      type="button"
                      onClick={handleAddStop}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100 transition-all cursor-pointer active:scale-95"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Ajouter un arrêt</span>
                    </button>
                  )}
                </div>

                {stops.map((stop, index) => {
                  const est = routeEstimations[index];
                  return (
                    <div
                      key={stop.id}
                      className="relative rounded-2xl bg-amber-50/40 border border-amber-200/60 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-black">
                            {index + 1}
                          </span>
                          <span className="text-[11px] font-bold text-[#1a3860]">
                            Arrêt {index + 1}
                          </span>
                          {est && (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/70 px-2 py-0.2 rounded-full">
                              ~{est.cumulativeDurationMinutes} min de route
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStop(stop.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Supprimer cet arrêt"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <AddressAutocompleteInput
                        required
                        value={stop.address}
                        dropdownPosition="top"
                        onChange={(addr, coords) => handleUpdateStop(stop.id, addr, coords)}
                        placeholder={`Adresse de l'arrêt ${index + 1}...`}
                        icon={MapPin}
                        iconColor="text-amber-600"
                      />
                    </div>
                  );
                })}
              </div>

              {/* 3. Lieu de destination */}
              <div className="space-y-1 pt-1 border-t border-slate-200/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1a3860]">Destination</span>
                  {churchSettings && (
                    <button
                      type="button"
                      onClick={handleResetToChurch}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e6f4f0] hover:bg-[#d6ede7] border border-[#bfe3da] text-xs font-bold text-[#1e7864] active:scale-95 transition-all shadow-xs"
                      title="Sélectionner l'adresse de l'église"
                    >
                      <Church className="h-3.5 w-3.5" />
                      <span>Adresse de l'église</span>
                    </button>
                  )}
                </div>

                <AddressAutocompleteInput
                  required
                  value={destinationAddress}
                  dropdownPosition="top"
                  onChange={(addr, coords) => {
                    setDestinationAddress(addr);
                    if (coords) {
                      setDestinationCoords(coords);
                      fitRouteBounds();
                    }
                  }}
                  placeholder="Entrez une destination..."
                  icon={Church}
                  iconColor="text-[#38917d]"
                />
              </div>

              {/* 4. Périmètre de détour toléré avec slider dynamique */}
              <div className="space-y-1.5 pt-1 border-t border-slate-200/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#1a3860]">
                    <Compass className="h-4 w-4 text-[#38917d]" />
                    <span>Détour toléré</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e6f4f0] text-[#38917d] border border-[#cce8e0]/80 shadow-xs">
                    {formatRadius(radiusMeters)}
                  </span>
                </div>

                <input
                  type="range"
                  min="200"
                  max="5000"
                  step="100"
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200/80 rounded-lg appearance-none cursor-pointer accent-[#38917d]"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>200 m</span>
                  <span>5 km</span>
                </div>
              </div>

              {/* 5. Bouton continuer vers l'étape 2 */}
              <button
                type="button"
                onClick={handleGoToStep2}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2d6cb5] via-[#2863a8] to-[#205595] text-sm font-bold text-white shadow-lg shadow-[#2d6cb5]/30 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Continuer vers les horaires</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ÉTAPE 2 : DATE, HEURE, ARRÊTS ESTIMÉS, PLACES & PUBLICATION   */}
      {/* ============================================================ */}
      {step === 2 && (
        <div className="relative min-h-dvh pb-16 overflow-hidden">
          <div className="pointer-events-none fixed -top-24 -right-24 h-96 w-96 rounded-full bg-blue-200/35 blur-3xl" />
          <div className="pointer-events-none fixed top-1/2 -left-28 h-80 w-80 rounded-full bg-teal-100/40 blur-3xl" />
          <div className="pointer-events-none fixed -bottom-20 right-10 h-72 w-72 rounded-full bg-indigo-100/25 blur-3xl" />

          {/* Barre supérieure Glassmorphism */}
          <div
            className="sticky top-0 z-30 flex items-center justify-between glass-panel px-4 py-3 border-b border-white/60"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0.75rem))" }}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex h-9 w-9 items-center justify-center rounded-2xl glass-card bg-white/80 hover:bg-white text-slate-700 border border-white/80 active:scale-95 transition-all shadow-xs cursor-pointer"
                title="Modifier l'itinéraire"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-base font-bold text-[#1a3860]">Horaires & Places</h1>
                <span className="text-[11px] font-semibold text-[#2d6cb5]">Étape 2 sur 2</span>
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50/80 border border-blue-100/60 text-[#2d6cb5] shadow-xs">
              <Car className="h-4 w-4" />
            </div>
          </div>

          <div className="relative z-10 p-4 max-w-md mx-auto space-y-3.5">
            {/* RÉCAPITULATIF DE L'ITINÉRAIRE AVEC HORAIRES ESTIMÉS */}
            <div className="glass-panel rounded-3xl p-4 border border-white/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-[#1a3860]">Itinéraire & Horaires estimés</span>
                <span className="text-[10px] font-extrabold text-[#38917d] bg-[#e6f4f0] px-2 py-0.5 rounded-full border border-[#cce8e0]">
                  ± {formatRadius(radiusMeters)}
                </span>
              </div>

              <div className="space-y-2 relative pl-1">
                {/* 1. Départ */}
                <div className="flex items-start gap-2.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#2d6cb5] flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1a3860] truncate">{departureAddress}</span>
                      <span className="font-bold text-[#2d6cb5] text-xs ml-2 flex-shrink-0">{time}</span>
                    </div>
                    <p className="text-[10px] text-slate-400">Point de départ</p>
                  </div>
                </div>

                {/* 2. Arrêts intermédiaires */}
                {validStops.map((stop, idx) => {
                  const est = routeEstimations[idx];
                  const durationMin = est?.cumulativeDurationMinutes ?? (idx + 1) * 10;
                  const stopTimeStr = getEstimatedStopTimeStr(time, durationMin);

                  return (
                    <div key={stop.id} className="flex items-start gap-2.5 text-xs pl-1">
                      <div className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800 truncate">
                            Arrêt {idx + 1} : {stop.address}
                          </span>
                          <span className="font-bold text-amber-700 text-xs ml-2 flex-shrink-0">
                            {stopTimeStr}
                          </span>
                        </div>
                        <p className="text-[10px] text-amber-600/90">
                          Passage estimé à +{durationMin} min • Heure de départ à cet arrêt
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* 3. Arrivée */}
                <div className="flex items-start gap-2.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#38917d] flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1a3860] truncate">{destinationAddress}</span>
                      {routeEstimations.length > 0 && (
                        <span className="font-bold text-[#38917d] text-xs ml-2 flex-shrink-0">
                          {getEstimatedStopTimeStr(
                            time,
                            routeEstimations[routeEstimations.length - 1]?.cumulativeDurationMinutes ?? 25
                          )}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">Destination finale</p>
                  </div>
                </div>
              </div>

              <div className="pt-1 text-right">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[11px] font-bold text-[#2d6cb5] hover:underline cursor-pointer"
                >
                  Modifier les arrêts ou adresses
                </button>
              </div>
            </div>

            {/* FORMULAIRE ÉTAPE 2 */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Date & Heure */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="glass-panel rounded-3xl p-3 border border-white/80 shadow-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#1a3860]">
                    <Calendar className="h-3.5 w-3.5 text-[#2d6cb5]" />
                    <span>Date</span>
                  </div>
                  <input
                    type="date"
                    required
                    min={todayStr}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="glass-panel rounded-3xl p-3 border border-white/80 shadow-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#1a3860]">
                    <Clock className="h-3.5 w-3.5 text-[#2d6cb5]" />
                    <span>Heure de départ</span>
                  </div>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* Nombre de places disponibles */}
              <div className="glass-panel rounded-3xl p-3.5 border border-white/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1a3860]">Places disponibles</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-[#2d6cb5] border border-blue-100">
                    {seats} {seats > 1 ? "places" : "place"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSeats(num)}
                      className={`flex-1 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                        seats === num
                          ? "bg-[#2d6cb5] text-white shadow-md shadow-[#2d6cb5]/30 scale-105"
                          : "glass-card bg-white/70 hover:bg-white text-slate-700 border border-white/80"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes complémentaires */}
              <div className="glass-panel rounded-3xl p-3.5 border border-white/80 shadow-xs space-y-1.5">
                <span className="text-xs font-bold text-[#1a3860]">Notes ou précisions</span>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex : Coffre spacieux, départ ponctuel, retour possible après le culte..."
                  className="w-full rounded-2xl bg-white/80 border border-slate-200/60 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2d6cb5]/30"
                />
              </div>

              {/* Bouton de publication */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2d6cb5] via-[#2863a8] to-[#205595] text-sm font-bold text-white shadow-xl shadow-[#2d6cb5]/30 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span>Publier mon trajet</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreateTripPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#f4f7fb]">
          <Loader2 className="h-7 w-7 animate-spin text-[#2d6cb5]" />
        </div>
      }
    >
      <CreateTripContent />
    </Suspense>
  );
}
