"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { BottomNav } from "@/components/navigation/BottomNav";
import { useToast } from "@/components/ui/ToastProvider";
import {
  ChevronLeft,
  Bell,
  MapPin,
  Sliders,
  Loader2,
  X,
  Compass,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const updateUserPreferences = useMutation(api.users.updateUserPreferences);

  // ÉTATS STRICTEMENT VRAIS : Initialisés à false.
  // Ils ne deviennent vrais QUE si le navigateur et l'appareil ont RÉELLEMENT accordé l'autorisation.
  const [pushEnabled, setPushEnabled] = useState(false);
  const [locationSharing, setLocationSharing] = useState(false);
  const [departureReminders, setDepartureReminders] = useState(true);
  const [hidePhoneUntilConfirmed, setHidePhoneUntilConfirmed] = useState(true);
  const [detourRadius, setDetourRadius] = useState(500);

  const [isLocating, setIsLocating] = useState(false);
  const [showSafariLocationGuide, setShowSafariLocationGuide] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronisation avec les VRAIES autorisations du navigateur & de l'appareil
  useEffect(() => {
    // 1. Vraie permission Notifications
    if (typeof window !== "undefined" && "Notification" in window) {
      const isGranted = Notification.permission === "granted";
      setPushEnabled(isGranted);
    } else {
      setPushEnabled(false);
    }

    // 2. Vraie permission Géolocalisation
    if (
      typeof window !== "undefined" &&
      "permissions" in navigator &&
      navigator.permissions?.query
    ) {
      navigator.permissions
        .query({ name: "geolocation" as any })
        .then((status) => {
          const isGranted = status.state === "granted";
          setLocationSharing(isGranted);

          status.onchange = () => {
            setLocationSharing(status.state === "granted");
          };
        })
        .catch(() => {
          // Si l'API query n'est pas supportée sur ce navigateur, vérifier par défaut false
          setLocationSharing(false);
        });
    } else {
      setLocationSharing(false);
    }

    // 3. Préférences de préférences internes (ex: rayon détour, masquage numéro)
    if (user && (user as any).preferences) {
      const prefs = (user as any).preferences;
      if (prefs.departureReminders !== undefined) {
        setDepartureReminders(prefs.departureReminders);
      }
      if (prefs.hidePhoneUntilConfirmed !== undefined) {
        setHidePhoneUntilConfirmed(prefs.hidePhoneUntilConfirmed);
      }
      if (prefs.preferredDetourRadius !== undefined) {
        setDetourRadius(prefs.preferredDetourRadius);
      }
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
    // Si déjà activé, on désactive
    if (pushEnabled) {
      setPushEnabled(false);
      await savePreference("pushNotifications", false);
      toast.info("Notifications désactivées.");
      return;
    }

    // Si désactivé, on demande l'autorisation native
    if (!("Notification" in window)) {
      toast.error("Les notifications ne sont pas supportées sur ce navigateur.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setPushEnabled(true);
        await savePreference("pushNotifications", true);
        toast.success("Notifications autorisées et activées !");
      } else {
        setPushEnabled(false);
        await savePreference("pushNotifications", false);
        toast.error("Autorisation refusée dans votre navigateur.");
      }
    } catch (e) {
      toast.error("Impossible de demander l'autorisation des notifications.");
      setPushEnabled(false);
    }
  };

  // Toggle Localisation GPS avec demande d'autorisation réelle du navigateur
  const handleToggleLocation = () => {
    // Si déjà activé, on désactive
    if (locationSharing) {
      setLocationSharing(false);
      savePreference("locationSharing", false);
      toast.info("Partage de position désactivé.");
      return;
    }

    // Si désactivé, on déclenche immédiatement la demande native de Safari
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      toast.error("La géolocalisation n'est pas supportée sur cet appareil.");
      return;
    }

    setIsLocating(true);

    const onLocationSuccess = (pos: GeolocationPosition) => {
      setIsLocating(false);
      setLocationSharing(true);
      savePreference("locationSharing", true);
      toast.success("Localisation autorisée et activée !");
    };

    const onLocationError = (err: GeolocationPositionError) => {
      console.warn("Erreur GPS lors de l'activation :", err.code, err.message);

      // Si erreur 1 (PERMISSION_DENIED) : Safari bloque l'accès
      if (err.code === 1) {
        setIsLocating(false);
        setLocationSharing(false);
        savePreference("locationSharing", false);
        setShowSafariLocationGuide(true);
        return;
      }

      // Si timeout ou GPS faible : repli automatique vers localisation réseau (WiFi / antennes)
      navigator.geolocation.getCurrentPosition(
        onLocationSuccess,
        () => {
          setIsLocating(false);
          setLocationSharing(false);
          savePreference("locationSharing", false);
          toast.error("Signal GPS introuvable. Vérifiez que la localisation est active.");
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
      );
    };

    // Appel direct déclenché par le geste de l'utilisateur
    navigator.geolocation.getCurrentPosition(onLocationSuccess, onLocationError, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0,
    });
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
    <div className="relative min-h-dvh bg-[#f4f7fb] text-slate-800 pb-24 select-none overflow-x-hidden">
      {/* Halos d'ambiance glassy subtils */}
      <div className="pointer-events-none fixed -top-20 -right-20 h-80 w-80 rounded-full bg-teal-200/20 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-1/3 -left-20 h-72 w-72 rounded-full bg-blue-100/30 blur-3xl z-0" />

      {/* EN-TÊTE FIXE ÉPURÉ */}
      <div
        className="sticky top-0 z-30 glass-panel bg-white/85 backdrop-blur-2xl border-b border-white/80 px-4 pb-3 shadow-2xs"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))" }}
      >
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            onClick={() => router.push("/profile")}
            className="flex h-9 w-9 items-center justify-center rounded-2xl glass-card bg-white/90 text-[#1a3860] hover:bg-white active:scale-95 transition-all shadow-2xs border border-white/90"
            title="Retour"
          >
            <ChevronLeft className="h-5 w-5 stroke-[2.4]" />
          </button>
          <div>
            <h1 className="text-base font-bold text-[#1a3860]">Réglages</h1>
            <p className="text-[11px] text-[#7d8fa5] font-medium">Préférences et autorisations</p>
          </div>
        </div>
      </div>

      {/* CONTENU PRINCIPAL */}
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
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">Notifications push</span>
                  {pushEnabled ? (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Autorisé
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      Désactivé
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Alertes de réservations et rappels
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleNotifications}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  pushEnabled ? "bg-[#138872]" : "bg-slate-200"
                }`}
                aria-label="Activer les notifications"
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
              <div>
                <span className="font-medium text-slate-800">Rappel avant départ</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Notification 30 min avant le trajet</p>
              </div>
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
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">Partage de position GPS</span>
                  {isLocating ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
                      <Loader2 className="h-3 w-3 animate-spin" /> Détection...
                    </span>
                  ) : locationSharing ? (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Autorisé
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      Désactivé
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Afficher ma position et calculer les itinéraires
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleLocation}
                disabled={isLocating}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  locationSharing ? "bg-[#138872]" : "bg-slate-200"
                }`}
                aria-label="Activer la géolocalisation"
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
              <div>
                <span className="font-medium text-slate-800">Masquer mon numéro par défaut</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Visible uniquement après confirmation</p>
              </div>
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

        {/* 3. PRÉFÉRENCE DE DÉTOUR (CONDUCTEUR) */}
        <div className="rounded-3xl glass-card bg-white p-4 border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-[#2d6cb5]" />
            <h2 className="text-xs font-bold text-[#1a3860]">Rayon de détour accepté</h2>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Distance maximale</span>
              <span className="font-bold text-[#2d6cb5] bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                {formatDistanceLabel(detourRadius)}
              </span>
            </div>

            <input
              type="range"
              min={100}
              max={3000}
              step={100}
              value={detourRadius}
              onChange={handleSliderChange}
              className="w-full accent-[#2d6cb5] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>100 m</span>
              <span>1,5 km</span>
              <span>3 km</span>
            </div>
          </div>
        </div>
      </div>

      {/* GUIDE VISUEL SAFARI SI REFUSÉ (MODALE BASSE ÉPURÉE) */}
      {showSafariLocationGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 animate-in slide-in-from-bottom-4 duration-200 space-y-4">
            <button
              type="button"
              onClick={() => setShowSafariLocationGuide(false)}
              className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-[#138872]">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Autoriser la position dans Safari
                </h3>
                <p className="text-[11px] text-slate-500">
                  Safari bloque actuellement la demande automatique
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 rounded-full bg-[#175276] text-white text-[10px] font-bold items-center justify-center flex-shrink-0 mt-0.5">
                  1
                </span>
                <p className="leading-snug">
                  Touchez le bouton <strong>« aA »</strong> (ou réglages) tout à gauche dans la barre d'adresse de Safari.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 rounded-full bg-[#175276] text-white text-[10px] font-bold items-center justify-center flex-shrink-0 mt-0.5">
                  2
                </span>
                <p className="leading-snug">
                  Touchez <strong>« Réglages du site web »</strong>.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 rounded-full bg-[#175276] text-white text-[10px] font-bold items-center justify-center flex-shrink-0 mt-0.5">
                  3
                </span>
                <p className="leading-snug">
                  Réglez <strong>« Emplacement »</strong> sur <strong>« Autoriser »</strong> (ou Demander).
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSafariLocationGuide(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSafariLocationGuide(false);
                  handleToggleLocation();
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#138872] hover:bg-[#0f6c5b] text-white font-bold text-xs transition shadow-sm"
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barre de navigation basse */}
      <BottomNav userRole={(user as any)?.role} />
    </div>
  );
}
