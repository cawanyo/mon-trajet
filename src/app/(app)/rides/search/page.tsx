"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { AddressAutocompleteInput } from "@/components/ui/AddressAutocompleteInput";
import { reverseGeocode } from "@/lib/geo";
import { useToast } from "@/components/ui/ToastProvider";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MapPin,
  Calendar,
  Users,
  ChevronLeft,
  Compass,
  LocateFixed,
  Church,
  Search,
  Loader2,
  Car,
} from "lucide-react";

function RideSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const mapRef = useRef<any>(null);
  const churchSettings = useQuery(api.settings.getChurchSettings);

  // Départ
  const [departureAddress, setDepartureAddress] = useState("");
  const [departureCoords, setDepartureCoords] = useState<{ lat: number; lng: number }>({
    lat: 48.8566,
    lng: 2.3522,
  });

  // Destination (par défaut l'église configurée)
  const [destinationAddress, setDestinationAddress] = useState("");
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number }>({
    lat: 48.8566,
    lng: 2.3522,
  });

  // Flag pour initialiser l'église une seule fois (permet d'effacer le champ librement)
  const hasInitializedChurchRef = useRef(false);

  // Date (par défaut aujourd'hui)
  const todayStr = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(todayStr);

  // Nombre de personnes demandées (par défaut 1)
  const [seats, setSeats] = useState(1);

  const [isLocating, setIsLocating] = useState(false);

  // État de vue de la carte
  const [viewState, setViewState] = useState({
    latitude: 48.8566,
    longitude: 2.3522,
    zoom: 13,
  });

  // Initialisation de l'adresse de l'église
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

  // Si des coordonnées GPS ont été passées dans l'URL
  useEffect(() => {
    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");
    if (latParam && lngParam && !departureAddress) {
      const latVal = parseFloat(latParam);
      const lngVal = parseFloat(lngParam);
      setDepartureCoords({ lat: latVal, lng: lngVal });
      reverseGeocode(latVal, lngVal).then((addr) => {
        setDepartureAddress(addr);
      });
      setViewState((prev) => ({
        ...prev,
        latitude: latVal,
        longitude: lngVal,
      }));
    }
  }, [searchParams]);

  // Détection GPS avec géocodage inverse automatique vers une vraie adresse
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      toast.error("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setDepartureCoords({ lat: latitude, lng: longitude });
        try {
          const realAddress = await reverseGeocode(latitude, longitude);
          setDepartureAddress(realAddress);
        } catch {
          // Évite "Ma position"
        }
        setIsLocating(false);

        if (mapRef.current) {
          const map = mapRef.current.getMap ? mapRef.current.getMap() : mapRef.current;
          map?.flyTo({ center: [longitude, latitude], zoom: 14, duration: 1200 });
        }
      },
      (err) => {
        setIsLocating(false);
        toast.error("Impossible d'accéder au GPS : " + err.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Réinitialiser la destination avec l'adresse de l'église
  const handleResetToChurch = () => {
    if (churchSettings) {
      setDestinationAddress(churchSettings.address);
      setDestinationCoords({
        lat: churchSettings.lat,
        lng: churchSettings.lng,
      });
      if (departureAddress) {
        fitRouteBounds();
      }
    }
  };

  // Ajustement de la carte pour afficher départ et arrivée
  const fitRouteBounds = () => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap ? mapRef.current.getMap() : mapRef.current;
    if (!map) return;

    if (!departureAddress && destinationAddress) {
      map.easeTo({
        center: [destinationCoords.lng, destinationCoords.lat],
        zoom: 14,
        duration: 800,
      });
      return;
    }

    if (departureAddress && !destinationAddress) {
      map.easeTo({
        center: [departureCoords.lng, departureCoords.lat],
        zoom: 14,
        duration: 800,
      });
      return;
    }

    const minLng = Math.min(departureCoords.lng, destinationCoords.lng);
    const maxLng = Math.max(departureCoords.lng, destinationCoords.lng);
    const minLat = Math.min(departureCoords.lat, destinationCoords.lat);
    const maxLat = Math.max(departureCoords.lat, destinationCoords.lat);

    if (Math.abs(minLng - maxLng) < 0.0001 && Math.abs(minLat - maxLat) < 0.0001) {
      map.easeTo({
        center: [departureCoords.lng, departureCoords.lat],
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
          padding: { top: 90, bottom: 380, left: 50, right: 50 },
          duration: 900,
          maxZoom: 15,
        }
      );
    } catch (e) {
      console.warn("fitRouteBounds ignoré :", e);
    }
  };

  // Synchronisation de la ligne entre départ et arrivée
  const syncMapLayers = () => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap ? mapRef.current.getMap() : mapRef.current;
    if (!map || typeof map.isStyleLoaded !== "function" || !map.isStyleLoaded()) return;

    try {
      if (departureAddress && destinationAddress) {
        const routeLineGeoJSON = {
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

        const existingLineSource = map.getSource("search-route-source");
        if (existingLineSource) {
          (existingLineSource as any).setData(routeLineGeoJSON);
        } else {
          map.addSource("search-route-source", {
            type: "geojson",
            data: routeLineGeoJSON,
          });

          if (!map.getLayer("search-route-casing")) {
            map.addLayer({
              id: "search-route-casing",
              type: "line",
              source: "search-route-source",
              paint: {
                "line-color": "#ffffff",
                "line-width": 6,
                "line-opacity": 0.9,
              },
            });
          }

          if (!map.getLayer("search-route-main")) {
            map.addLayer({
              id: "search-route-main",
              type: "line",
              source: "search-route-source",
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
      }
    } catch (e) {
      console.warn("syncMapLayers search :", e);
    }
  };

  useEffect(() => {
    syncMapLayers();
    if (departureAddress && destinationAddress) {
      setTimeout(fitRouteBounds, 150);
    }
  }, [departureCoords, destinationCoords, departureAddress, destinationAddress]);

  // Lancement de la recherche
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!departureAddress) {
      toast.error("Veuillez indiquer un lieu de prise en charge.");
      return;
    }

    const params = new URLSearchParams({
      fromLat: departureCoords.lat.toString(),
      fromLng: departureCoords.lng.toString(),
      fromAddress: departureAddress,
      toLat: destinationCoords.lat.toString(),
      toLng: destinationCoords.lng.toString(),
      toAddress: destinationAddress || "Église",
      date,
      seats: seats.toString(),
    });

    router.push(`/rides?${params.toString()}`);
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-slate-100 select-none">
      {/* 1. CARTE EN PLEIN ÉCRAN */}
      <div className="absolute inset-0 z-0">
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

          {/* Marqueur Départ (Pin vert turquoise avec silhouette personne) */}
          {departureAddress && (
            <Marker
              latitude={departureCoords.lat}
              longitude={departureCoords.lng}
              anchor="bottom"
            >
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#138872] text-white shadow-xl ring-2 ring-white animate-in zoom-in-75">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="h-2 w-2 rotate-45 bg-[#138872] -mt-1 ring-1 ring-white" />
              </div>
            </Marker>
          )}

          {/* Marqueur Destination (Pin bleu avec icône église) */}
          {destinationAddress && (
            <Marker
              latitude={destinationCoords.lat}
              longitude={destinationCoords.lng}
              anchor="bottom"
            >
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2669e2] text-white shadow-xl ring-2 ring-white animate-in zoom-in-75">
                  <Church className="h-5 w-5" />
                </div>
                <div className="h-2 w-2 rotate-45 bg-[#2669e2] -mt-1 ring-1 ring-white" />
              </div>
            </Marker>
          )}
        </Map>
      </div>

      {/* Bouton retour circulaire en haut à gauche */}
      <div className="absolute top-4 left-4 z-20">
        <button
          onClick={() => router.push("/")}
          className="flex h-11 w-11 items-center justify-center rounded-full glass-card bg-white/90 backdrop-blur-xl text-slate-700 shadow-md border border-white/90 hover:bg-white active:scale-95 transition-all"
          title="Retour à l'accueil"
        >
          <ChevronLeft className="h-6 w-6 stroke-[2.4]" />
        </button>
      </div>

      {/* Bouton recentrer au-dessus du tiroir */}
      <div className="absolute bottom-[365px] sm:bottom-[385px] right-4 z-20">
        <button
          onClick={fitRouteBounds}
          className="flex h-10 w-10 items-center justify-center rounded-full glass-card bg-white/90 backdrop-blur-xl text-[#1a3860] shadow-lg border border-white/90 hover:bg-white active:scale-95 transition-all"
          title="Centrer l'itinéraire"
        >
          <Compass className="h-5 w-5 stroke-[2.2] text-[#1a3860]" />
        </button>
      </div>

      {/* 2. TIROIR GLASSY FLOTTANT INFÉRIEUR */}
      <div className="absolute bottom-2 left-2 right-2 max-w-md mx-auto z-30">
        <div className="rounded-[32px] glass-panel bg-white/90 backdrop-blur-2xl border border-white/90 p-4 pt-2.5 pb-4 shadow-2xl space-y-3">
          {/* Poignée du tiroir */}
          <div className="w-10 h-1 bg-slate-300/80 rounded-full mx-auto" />

          {/* En-tête concise */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-[#1a3860] tracking-tight">
                Rechercher un trajet
              </h2>
              <p className="text-[11px] text-[#7d8fa5] font-medium">
                Trouvez un conducteur pour aller à l'église
              </p>
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-50 text-[#138872]">
              <Search className="h-4 w-4" />
            </span>
          </div>

          <form onSubmit={handleSearch} className="space-y-2.5">
            {/* Input 1 : Lieu de départ avec GPS */}
            <div className="relative">
              <AddressAutocompleteInput
                label="Lieu de prise en charge"
                required
                placeholder="Où souhaitez-vous être pris en charge ?"
                value={departureAddress}
                dropdownPosition="top"
                onChange={(addr, coords) => {
                  setDepartureAddress(addr);
                  if (coords) {
                    setDepartureCoords(coords);
                    setViewState((prev) => ({
                      ...prev,
                      latitude: coords.lat,
                      longitude: coords.lng,
                    }));
                  }
                }}
              />
              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={isLocating}
                className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold text-teal-700 bg-teal-50/90 hover:bg-teal-100 transition-colors border border-teal-200/50"
              >
                {isLocating ? (
                  <Loader2 className="h-3 w-3 animate-spin text-teal-600" />
                ) : (
                  <LocateFixed className="h-3 w-3 text-teal-600" />
                )}
                <span>Position GPS</span>
              </button>
            </div>

            {/* Input 2 : Destination */}
            <div className="relative">
              <AddressAutocompleteInput
                label="Destination"
                required
                placeholder="Adresse d'arrivée (ex: Église...)"
                value={destinationAddress}
                dropdownPosition="top"
                onChange={(addr, coords) => {
                  setDestinationAddress(addr);
                  if (coords) {
                    setDestinationCoords(coords);
                  }
                }}
              />
              <button
                type="button"
                onClick={handleResetToChurch}
                className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold text-blue-700 bg-blue-50/90 hover:bg-blue-100 transition-colors border border-blue-200/50"
              >
                <Church className="h-3 w-3 text-blue-600" />
                <span>Adresse de l'église</span>
              </button>
            </div>

            {/* Ligne Date & Nombre de places */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              {/* Date */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#1a3860] flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-blue-600" />
                  <span>Date</span>
                </label>
                <input
                  type="date"
                  value={date}
                  min={todayStr}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              {/* Nombre de personnes */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#1a3860] flex items-center gap-1">
                  <Users className="h-3 w-3 text-blue-600" />
                  <span>Personnes</span>
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSeats(n)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        seats === n
                          ? "bg-[#175276] text-white shadow-xs"
                          : "bg-slate-100/90 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bouton Rechercher */}
            <button
              type="submit"
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#1b7f80]/25 hover:opacity-95 active:scale-[0.98] transition-all mt-1"
            >
              <Search className="h-4 w-4" />
              <span>Rechercher un trajet</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function RideSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-100">
          <Loader2 className="h-8 w-8 animate-spin text-[#175276]" />
        </div>
      }
    >
      <RideSearchContent />
    </Suspense>
  );
}
