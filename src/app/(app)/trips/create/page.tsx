"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { AddressAutocompleteInput } from "@/components/ui/AddressAutocompleteInput";
import { reverseGeocode } from "@/lib/geo";
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
} from "lucide-react";

function CreateTripContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token } = useAuth();
  const { toast } = useToast();

  // Étape courante : 1 = Carte & Itinéraire, 2 = Horaires & Places
  const [step, setStep] = useState<1 | 2>(1);

  // Référence à la carte MapLibre
  const mapRef = useRef<any>(null);

  // Récupération de l'adresse de l'église configurée par le manager
  const churchSettings = useQuery(api.settings.getChurchSettings);
  const createTrip = useMutation(api.trips.createTrip);

  // Lieu de départ
  const [departureAddress, setDepartureAddress] = useState("");
  const [departureCoords, setDepartureCoords] = useState<{ lat: number; lng: number }>({
    lat: 48.8566,
    lng: 2.3522,
  });

  // Lieu de destination (initialisé à l'église une seule fois)
  const [destinationAddress, setDestinationAddress] = useState("");
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number }>({
    lat: 48.8566,
    lng: 2.3522,
  });

  // Flag pour ne charger l'église par défaut qu'une seule fois (permet d'effacer le champ librement)
  const hasInitializedChurchRef = useRef(false);

  // Date et Heure
  const todayStr = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState("");

  // Nombre de places
  const [seats, setSeats] = useState(3);

  // Périmètre toléré (200 m à 5 km, défaut: 500 m ou préférence utilisateur)
  const [radiusMeters, setRadiusMeters] = useState(500);

  // Initialisation du détour par défaut depuis les préférences utilisateur des paramètres
  useEffect(() => {
    if (user && (user as any).preferences?.preferredDetourRadius) {
      setRadiusMeters((user as any).preferences.preferredDetourRadius);
    }
  }, [user]);

  // Pré-remplissage avec l'adresse de la maison si configurée dans le profil
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

  // Initialisation avec l'église UNE SEULE FOIS dès que les settings Convex sont chargés
  useEffect(() => {
    if (churchSettings && !hasInitializedChurchRef.current) {
      hasInitializedChurchRef.current = true;
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
  }, [churchSettings]);

  // Si des coordonnées GPS initiales ont été passées dans l'URL depuis la carte
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

  // Formatage du rayon pour l'affichage (ex: 500 m ou 1,5 km)
  const formatRadius = (meters: number) => {
    if (meters < 1000) return `${meters} m`;
    const km = meters / 1000;
    return `${km % 1 === 0 ? km : km.toFixed(1).replace(".", ",")} km`;
  };

  // Ajuste la vue de la carte pour afficher à la fois le départ et la destination
  const fitRouteBounds = (
    c1 = departureCoords,
    c2 = destinationCoords
  ) => {
    if (!mapRef.current || !c1) return;
    const map = mapRef.current.getMap ? mapRef.current.getMap() : mapRef.current;
    if (!map) return;

    if (!c2 || !destinationAddress.trim()) {
      map.easeTo({
        center: [c1.lng, c1.lat],
        zoom: 14,
        duration: 800,
      });
      return;
    }

    const minLng = Math.min(c1.lng, c2.lng);
    const maxLng = Math.max(c1.lng, c2.lng);
    const minLat = Math.min(c1.lat, c2.lat);
    const maxLat = Math.max(c1.lat, c2.lat);

    if (Math.abs(minLng - maxLng) < 0.0001 && Math.abs(minLat - maxLat) < 0.0001) {
      map.easeTo({
        center: [c1.lng, c1.lat],
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
          padding: { top: 90, bottom: 330, left: 50, right: 50 },
          duration: 800,
          maxZoom: 16,
        }
      );
    } catch (err) {
      console.warn("fitRouteBounds ignoré :", err);
    }
  };



  // Détection robuste de la position actuelle du conducteur
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
      fitRouteBounds(newCoords, destinationCoords);
    };

    // Stratégie double : essai haute précision (5s), puis bascule automatique standard/cache (15s)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err1) => {
        if (err1.code === 1) {
          setIsLocating(false);
          toast.error(
            "Position refusée. Sur iPhone : appuyez sur 'aA' dans Safari > Réglages du site web > Emplacement > Autoriser."
          );
          return;
        }
        console.warn("Échec haute précision GPS, tentative standard :", err1.message);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            applyLocation(pos.coords.latitude, pos.coords.longitude);
          },
          (err2) => {
            setIsLocating(false);
            console.error("Échec géolocalisation complète :", err2.message);
            toast.error("Impossible d'accéder au GPS. Veuillez saisir votre adresse.");
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  };

  // Réinitialiser la destination avec l'adresse officielle de l'église
  const handleResetToChurch = () => {
    if (churchSettings) {
      const churchCoords = {
        lat: churchSettings.lat,
        lng: churchSettings.lng,
      };
      setDestinationAddress(churchSettings.address);
      setDestinationCoords(churchCoords);
      fitRouteBounds(departureCoords, churchCoords);
    }
  };

  // Génération géométrique du polygone GeoJSON représentant le cercle de détour toléré
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

  // Ligne GeoJSON reliant le départ et la destination
  const routeLineGeoJSON = useMemo(() => {
    if (!departureCoords?.lat || !destinationCoords?.lat || !destinationAddress.trim()) return null;
    return {
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [departureCoords.lng, departureCoords.lat],
          [destinationCoords.lng, destinationCoords.lat],
        ],
      },
      properties: {},
    };
  }, [departureCoords.lat, departureCoords.lng, destinationCoords.lat, destinationCoords.lng, destinationAddress]);

  // Mise à jour robuste et directe des calques MapLibre (cercle de détour & ligne d'itinéraire)
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

      // 2. Ligne reliant départ et destination
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

  // Synchronisation dès que les données du cercle ou de la ligne changent
  useEffect(() => {
    updateMapLayers();
  }, [circleGeoJSON, routeLineGeoJSON, destinationAddress]);

  // Passage à l'étape 2 (Validation des lieux)
  const handleGoToStep2 = () => {
    if (!departureAddress.trim()) {
      toast.error("Veuillez renseigner un lieu de départ.");
      return;
    }
    if (!destinationAddress.trim()) {
      toast.error("Veuillez renseigner un lieu de destination.");
      return;
    }
    setStep(2);
  };

  // Soumission finale du trajet (depuis l'étape 2)
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
        departureTime: departureDate.getTime(),
        totalSeats: seats,
        pickupRadiusMeters: radiusMeters,
        notes: notes.trim() || undefined,
      });

      router.push(`/trips/success?id=${tripId}`);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création du trajet");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-dvh bg-[#f4f7fb] text-slate-800 select-none overflow-hidden">
      {/* ============================================================ */}
      {/* ÉTAPE 1 : CARTE INTERACTIVE, ITINÉRAIRE & CERCLE DE DÉTOUR    */}
      {/* ============================================================ */}
      {step === 1 && (
        <div className="relative h-dvh w-full overflow-hidden bg-slate-100">
          {/* CARTE PLEIN ÉCRAN IMMERSIVE */}
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
              <Marker
                latitude={departureCoords.lat}
                longitude={departureCoords.lng}
                anchor="bottom"
              >
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

            {/* Marqueur Destination (Église / Arrivée #38917d) - visible uniquement si renseigné */}
            {destinationAddress.trim() && destinationCoords && (
              <Marker
                latitude={destinationCoords.lat}
                longitude={destinationCoords.lng}
                anchor="bottom"
              >
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
                  <span className="text-[11px] font-semibold text-[#2d6cb5]">
                    Étape 1 sur 2
                  </span>
                </div>
              </div>

              {/* Bouton recentrer la vue sur l'itinéraire */}
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

          {/* TIROIR FLOTTANT INFÉRIEUR GLASSY (DÉPART, DESTINATION, DÉTOUR, CONTINUER) */}
          <div
            className="absolute inset-x-3 max-w-md mx-auto z-20"
            style={{ bottom: "max(0.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))" }}
          >
            <div className="glass-panel rounded-3xl p-4 shadow-2xl border border-white/80 space-y-3 overflow-visible">
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
                      fitRouteBounds(coords, destinationCoords);
                    }
                  }}
                  placeholder="Adresse de départ..."
                  icon={MapPin}
                  iconColor="text-[#2d6cb5]"
                />
              </div>

              {/* 2. Lieu de destination */}
              <div className="space-y-1 pt-1.5 border-t border-slate-200/50">
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
                      fitRouteBounds(departureCoords, coords);
                    }
                  }}
                  placeholder="Entrez une destination..."
                  icon={Church}
                  iconColor="text-[#38917d]"
                />
              </div>

              {/* 3. Périmètre de détour toléré avec slider dynamique */}
              <div className="space-y-1.5 pt-1.5 border-t border-slate-200/50">
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

              {/* 4. Bouton continuer vers l'étape 2 */}
              <button
                type="button"
                onClick={handleGoToStep2}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2d6cb5] via-[#2863a8] to-[#205595] text-sm font-bold text-white shadow-lg shadow-[#2d6cb5]/30 hover:opacity-95 active:scale-[0.98] transition-all"
              >
                <span>Continuer</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ÉTAPE 2 : DATE, HEURE, PLACES, NOTE & PUBLICATION              */}
      {/* ============================================================ */}
      {step === 2 && (
        <div className="relative min-h-dvh pb-16 overflow-hidden">
          {/* Halos d'ambiance pour accentuer l'effet de réfraction du verre dépoli */}
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
                className="flex h-9 w-9 items-center justify-center rounded-2xl glass-card bg-white/80 hover:bg-white text-slate-700 border border-white/80 active:scale-95 transition-all shadow-xs"
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
            {/* RÉCAPITULATIF DE L'ITINÉRAIRE */}
            <div className="glass-panel rounded-3xl p-3.5 border border-white/80 shadow-xs flex items-center justify-between">
              <div className="min-w-0 flex-1 space-y-1.5 pr-3">
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#2d6cb5] flex-shrink-0" />
                  <span className="font-semibold text-slate-800 truncate">
                    {departureAddress}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#38917d] flex-shrink-0" />
                  <span className="font-semibold text-slate-800 truncate">
                    {destinationAddress}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-[10px] font-extrabold text-[#38917d] bg-[#e6f4f0] px-2 py-0.5 rounded-full border border-[#cce8e0]">
                  ± {formatRadius(radiusMeters)}
                </span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[11px] font-bold text-[#2d6cb5] hover:underline"
                >
                  Modifier
                </button>
              </div>
            </div>

            {/* FORMULAIRE HORAIRES, PLACES & NOTE */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* CARTE : DATE & HEURE */}
              <div className="glass-panel rounded-3xl p-4 border border-white/80 shadow-sm space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  {/* Date */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#1a3860]">Date</label>
                    <div className="relative flex items-center">
                      <Calendar className="absolute left-3.5 h-4 w-4 text-[#2d6cb5] pointer-events-none" />
                      <input
                        type="date"
                        required
                        min={todayStr}
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200/80 py-2.5 pl-10 pr-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2d6cb5]/30 focus:border-[#2d6cb5] focus:bg-white shadow-xs transition-all"
                      />
                    </div>
                  </div>

                  {/* Heure */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#1a3860]">Heure</label>
                    <div className="relative flex items-center">
                      <Clock className="absolute left-3.5 h-4 w-4 text-[#2d6cb5] pointer-events-none" />
                      <input
                        type="time"
                        required
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200/80 py-2.5 pl-10 pr-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2d6cb5]/30 focus:border-[#2d6cb5] focus:bg-white shadow-xs transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Places disponibles */}
                <div className="pt-2 border-t border-slate-200/50 space-y-1.5">
                  <label className="block text-xs font-bold text-[#1a3860]">
                    Places disponibles
                  </label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <button
                        type="button"
                        key={num}
                        onClick={() => setSeats(num)}
                        className={`py-2 rounded-2xl text-xs font-bold transition-all ${
                          seats === num
                            ? "bg-gradient-to-r from-[#2d6cb5] to-[#255ea0] text-white shadow-md shadow-[#2d6cb5]/25 scale-105"
                            : "glass-card bg-white/70 hover:bg-white text-slate-600 border border-white/80"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* CARTE : NOTE (OPTIONNELLE) */}
              <div className="glass-panel rounded-3xl p-4 border border-white/80 shadow-sm space-y-1.5">
                <label className="block text-xs font-bold text-[#1a3860]">
                  Note <span className="text-slate-400 font-normal">(optionnel)</span>
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex : Coffre spacieux, départ ponctuel..."
                  className="w-full rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200/80 p-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2d6cb5]/30 focus:border-[#2d6cb5] focus:bg-white shadow-xs resize-none transition-all"
                />
              </div>

              {/* BOUTON D'ACTION PRINCIPALE */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2d6cb5] via-[#2863a8] to-[#205595] text-sm font-bold text-white shadow-lg shadow-[#2d6cb5]/25 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Car className="h-4 w-4" />
                      <span>Publier le trajet</span>
                    </>
                  )}
                </button>
              </div>
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
          <Loader2 className="h-6 w-6 animate-spin text-[#2d6cb5]" />
        </div>
      }
    >
      <CreateTripContent />
    </Suspense>
  );
}
