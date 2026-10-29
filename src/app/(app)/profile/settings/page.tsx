"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { BottomNav } from "@/components/navigation/BottomNav";
import {
  ChevronLeft,
  Bell,
  MapPin,
  Sliders,
  Loader2,
} from "lucide-react";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const updateUserPreferences = useMutation(api.users.updateUserPreferences);

  // Préférences locales avec 500m comme valeur initiale par défaut
  const [pushEnabled, setPushEnabled] = useState(true);
  const [departureReminders, setDepartureReminders] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);
  const [hidePhoneUntilConfirmed, setHidePhoneUntilConfirmed] = useState(true);
  const [detourRadius, setDetourRadius] = useState(500);

  const [isLocating, setIsLocating] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Charger les préférences existantes de l'utilisateur
  useEffect(() => {
    if (user && (user as any).preferences) {
      const prefs = (user as any).preferences;
      if (prefs.pushNotifications !== undefined) setPushEnabled(prefs.pushNotifications);
      if (prefs.departureReminders !== undefined) setDepartureReminders(prefs.departureReminders);
      if (prefs.locationSharing !== undefined) setLocationSharing(prefs.locationSharing);
      if (prefs.hidePhoneUntilConfirmed !== undefined) setHidePhoneUntilConfirmed(prefs.hidePhoneUntilConfirmed);
      if (prefs.preferredDetourRadius !== undefined) setDetourRadius(prefs.preferredDetourRadius);
    }
  }, [user]);

  // Sauvegarde Convex d'une préférence
  const savePreference = async (key: string, value: any) => {
    if (!token) return;
    try {
      await updateUserPreferences({
        token,
        preferences: {
          [key]: value,
        },
      });
    } catch (err: any) {
      console.error("Erreur sauvegarde préférence:", err);
    }
  };

  // Toggle Notifications Push avec demande d'autorisation réelle du navigateur
  const handleToggleNotifications = async () => {
    const nextVal = !pushEnabled;

    if (nextVal) {
      if (!("Notification" in window)) {
        alert("Les notifications push ne sont pas supportées sur ce navigateur.");
        return;
      }

      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          setPushEnabled(true);
          await savePreference("pushNotifications", true);
        } else {
          alert("Autorisation de notification refusée dans votre navigateur.");
          setPushEnabled(false);
          await savePreference("pushNotifications", false);
        }
      } catch (e) {
        alert("Impossible de demander l'autorisation des notifications.");
        setPushEnabled(false);
      }
    } else {
      setPushEnabled(false);
      await savePreference("pushNotifications", false);
    }
  };

  // Toggle Localisation GPS avec demande d'autorisation réelle du navigateur
  const handleToggleLocation = () => {
    const nextVal = !locationSharing;

    if (nextVal) {
      if (!("geolocation" in navigator)) {
        alert("La géolocalisation n'est pas supportée sur cet appareil.");
        return;
      }

      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocating(false);
          setLocationSharing(true);
          savePreference("locationSharing", true);
        },
        (err) => {
          setIsLocating(false);
          alert(
            "Autorisation GPS refusée ou indisponible. Veuillez activer la localisation dans les réglages de votre appareil."
          );
          setLocationSharing(false);
          savePreference("locationSharing", false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationSharing(false);
      savePreference("locationSharing", false);
    }
  };

  // Changement du rayon de détour via le slider (500m par défaut, debounce pour la sauvegarde)
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setDetourRadius(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      savePreference("preferredDetourRadius", val);
    }, 300);
  };

  // Formatage lisible de la distance (ex: 500 m ou 1,5 km)
  const formatDistanceLabel = (meters: number) => {
    if (meters < 1000) return `${meters} m`;
    const km = meters / 1000;
    return `${km % 1 === 0 ? km : km.toFixed(1).replace(".", ",")} km`;
  };

  return (
    <div className="relative min-h-screen bg-[#f4f7fb] text-slate-800 pb-24 select-none overflow-x-hidden">
      {/* Halos d'ambiance glassy subtils */}
      <div className="pointer-events-none fixed -top-20 -right-20 h-80 w-80 rounded-full bg-teal-200/20 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-1/3 -left-20 h-72 w-72 rounded-full bg-blue-100/30 blur-3xl z-0" />

      {/* EN-TÊTE FIXE ÉPURÉ */}
      <div className="sticky top-0 z-30 glass-panel bg-white/85 backdrop-blur-2xl border-b border-white/80 px-4 pt-4 pb-3 shadow-2xs">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            onClick={() => router.push("/profile")}
            className="flex h-9 w-9 items-center justify-center rounded-2xl glass-card bg-white/90 text-[#1a3860] hover:bg-white active:scale-95 transition-all shadow-2xs border border-white/90"
            title="Retour"
          >
            <ChevronLeft className="h-5 w-5 stroke-[2.4]" />
          </button>
          <h1 className="text-base font-bold text-[#1a3860]">
            Paramètres
          </h1>
        </div>
      </div>

      <div className="relative z-10 max-w-md mx-auto p-4 space-y-3.5">
        {/* 1. NOTIFICATIONS */}
        <div className="rounded-3xl glass-card bg-white p-4 border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#175276]" />
            <h2 className="text-xs font-bold text-[#1a3860]">Notifications</h2>
          </div>

          <div className="space-y-3 text-xs divide-y divide-slate-100/80">
            {/* Notifications Push */}
            <div className="flex items-center justify-between pt-1">
              <span className="font-medium text-slate-800">Notifications push</span>
              <button
                type="button"
                onClick={handleToggleNotifications}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  pushEnabled ? "bg-[#138872]" : "bg-slate-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                    pushEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Rappels avant le départ */}
            <div className="flex items-center justify-between pt-3">
              <span className="font-medium text-slate-800">Rappel avant départ (30 min)</span>
              <button
                type="button"
                onClick={() => {
                  const next = !departureReminders;
                  setDepartureReminders(next);
                  savePreference("departureReminders", next);
                }}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  departureReminders ? "bg-[#138872]" : "bg-slate-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                    departureReminders ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* 2. LOCALISATION & CONFIDENTIALITÉ */}
        <div className="rounded-3xl glass-card bg-white p-4 border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#138872]" />
            <h2 className="text-xs font-bold text-[#1a3860]">Localisation & Confidentialité</h2>
          </div>

          <div className="space-y-3 text-xs divide-y divide-slate-100/80">
            {/* Partage GPS (Demande réelle) */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-slate-800">Partage de position GPS</span>
                {isLocating && <Loader2 className="h-3 w-3 animate-spin text-[#138872]" />}
              </div>
              <button
                type="button"
                onClick={handleToggleLocation}
                disabled={isLocating}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  locationSharing ? "bg-[#138872]" : "bg-slate-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                    locationSharing ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Masquer numéro */}
            <div className="flex items-center justify-between pt-3">
              <span className="font-medium text-slate-800">Masquer mon numéro par défaut</span>
              <button
                type="button"
                onClick={() => {
                  const next = !hidePhoneUntilConfirmed;
                  setHidePhoneUntilConfirmed(next);
                  savePreference("hidePhoneUntilConfirmed", next);
                }}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  hidePhoneUntilConfirmed ? "bg-[#138872]" : "bg-slate-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                    hidePhoneUntilConfirmed ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* 3. DÉTOUR TOLÉRÉ AVEC SLIDER (500M INITIAL) */}
        <div className="rounded-3xl glass-card bg-white p-4 border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-blue-600" />
              <h2 className="text-xs font-bold text-[#1a3860]">Détour toléré par défaut</h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200/60 text-xs font-extrabold text-[#138872]">
              {formatDistanceLabel(detourRadius)}
            </span>
          </div>

          <div className="space-y-1.5 pt-1">
            <input
              type="range"
              min={200}
              max={5000}
              step={100}
              value={detourRadius}
              onChange={handleSliderChange}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#138872]"
            />
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
              <span>200 m</span>
              <span>5 km</span>
            </div>
          </div>
        </div>
      </div>

      {/* Barre de navigation inférieure */}
      <BottomNav userRole={user?.role ?? "user"} />
    </div>
  );
}
