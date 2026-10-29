"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { AddressAutocompleteInput } from "@/components/ui/AddressAutocompleteInput";
import { useToast } from "@/components/ui/ToastProvider";
import {
  MapPin,
  ChevronLeft,
  Loader2,
  HeartHandshake,
  LocateFixed,
  Check,
  Calendar,
  Clock,
  MessageSquare,
  Sparkles,
} from "lucide-react";

const START_HOURS = Array.from({ length: 24 }, (_, i) => i);
const END_HOURS = Array.from({ length: 24 }, (_, i) => i + 1);
const formatHourLabel = (h: number) => `${String(h).padStart(2, "0")}h`;

function CreateNeedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const createRequest = useMutation(api.requests.createRequest);
  const churchSettings = useQuery(api.settings.getChurchSettings);

  // Paramètres passés depuis la recherche
  const paramFromLat = searchParams.get("fromLat") || searchParams.get("lat");
  const paramFromLng = searchParams.get("fromLng") || searchParams.get("lng");
  const paramFromAddress = searchParams.get("fromAddress") || "";
  const paramToLat = searchParams.get("toLat");
  const paramToLng = searchParams.get("toLng");
  const paramToAddress = searchParams.get("toAddress") || "";
  const paramDate = searchParams.get("date") || "";
  const paramSeats = parseInt(searchParams.get("seats") || "1", 10) || 1;
  const paramStartHour = searchParams.get("startHour") || "5";
  const paramEndHour = searchParams.get("endHour") || "24";

  // Plage horaire modifiable
  const [startHour, setStartHour] = useState<number>(parseInt(paramStartHour, 10) || 5);
  const [endHour, setEndHour] = useState<number>(parseInt(paramEndHour, 10) || 24);

  // État local pré-rempli
  const [pickupAddress, setPickupAddress] = useState(paramFromAddress);
  const [lat, setLat] = useState(paramFromLat ? parseFloat(paramFromLat) : 48.8566);
  const [lng, setLng] = useState(paramFromLng ? parseFloat(paramFromLng) : 2.3522);
  const [destAddress, setDestAddress] = useState(paramToAddress);
  const [destLat, setDestLat] = useState(paramToLat ? parseFloat(paramToLat) : 48.8566);
  const [destLng, setDestLng] = useState(paramToLng ? parseFloat(paramToLng) : 2.3522);
  const [seats, setSeats] = useState(paramSeats);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingRoute, setIsEditingRoute] = useState(false);

  // Initialisation église par défaut si pas de destination spécifiée
  useEffect(() => {
    if (churchSettings) {
      if (!destAddress) setDestAddress(churchSettings.address);
      if (!paramToLat) setDestLat(churchSettings.lat);
      if (!paramToLng) setDestLng(churchSettings.lng);
    }
  }, [churchSettings, destAddress, paramToLat, paramToLng]);

  // Redirection : on ne peut plus publier de demande directement, il faut d'abord chercher un trajet
  useEffect(() => {
    router.replace("/rides/search");
  }, [router]);

  const detectLocation = () => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setPickupAddress("Ma position actuelle");
        },
        (err) => {
          toast.error("Impossible d'accéder au GPS : " + err.message);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.info("Veuillez vous connecter pour publier votre besoin.");
      router.push("/login");
      return;
    }

    setIsSubmitting(true);
    try {
      const timeNote = `Créneau : ${formatHourLabel(startHour)} - ${formatHourLabel(endHour)}`;
      const fullNote = note.trim() ? `${note.trim()} (${timeNote})` : timeNote;

      await createRequest({
        token,
        pickupLocation: {
          lat,
          lng,
          address: pickupAddress || "Lieu convenu avec le conducteur",
        },
        destinationLocation: {
          lat: destLat,
          lng: destLng,
          address: destAddress || "Église",
        },
        seatsRequested: seats,
        note: fullNote,
      });

      toast.success("Votre besoin de trajet a été publié !");
      router.push("/");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la publication");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Libellé de date lisible
  const dateFormatted = paramDate
    ? new Date(paramDate + "T12:00:00").toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "Aujourd'hui";

  return (
    <div className="relative min-h-screen bg-[#f4f7fb] text-slate-800 pb-20 select-none overflow-x-hidden">
      {/* Halos d'ambiance glassy */}
      <div className="pointer-events-none fixed -top-24 -right-24 h-96 w-96 rounded-full bg-teal-200/30 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-1/2 -left-28 h-80 w-80 rounded-full bg-blue-100/40 blur-3xl z-0" />

      {/* En-tête fixe glassy */}
      <div className="sticky top-0 z-30 glass-panel bg-white/85 backdrop-blur-2xl border-b border-white/80 px-4 pt-4 pb-3 shadow-xs">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-2xl glass-card bg-white/90 text-slate-700 hover:text-[#1a3860] active:scale-95 transition-all shadow-xs border border-white/90"
            title="Retour"
          >
            <ChevronLeft className="h-5 w-5 stroke-[2.4]" />
          </button>
          <div>
            <h1 className="text-lg font-black text-[#1a3860] tracking-tight">
              Signaler un besoin de trajet
            </h1>
            <p className="text-xs font-semibold text-[#7d8fa5]">
              Vos informations sont prêtes • Vérifiez et validez
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 p-4 max-w-md mx-auto space-y-4">
        {/* Bannière explicative discrète */}
        <div className="rounded-3xl glass-card bg-[#eef7f5]/90 backdrop-blur-xl p-4 border border-[#cbe8df] flex items-start gap-3 shadow-2xs">
          <HeartHandshake className="h-5 w-5 text-[#138872] flex-shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-[#13594b] leading-relaxed">
            Votre signal apparaîtra sous forme de repère sur la carte de l'église. Les conducteurs passant à proximité pourront vous accepter directement.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* CARTE RÉCAPITULATIVE DE L'ITINÉRAIRE */}
          <div className="rounded-3xl glass-card bg-white/90 backdrop-blur-xl p-4.5 border border-white/95 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-xs font-extrabold text-[#1a3860] uppercase tracking-wider">
                Itinéraire
              </span>
              <button
                type="button"
                onClick={() => setIsEditingRoute((v) => !v)}
                className="text-xs font-bold text-[#138872] hover:underline"
              >
                {isEditingRoute ? "Fermer" : "Modifier"}
              </button>
            </div>

            {!isEditingRoute ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-[#138872] flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-400 block text-[10px] uppercase tracking-wider">
                      Prise en charge
                    </span>
                    <span className="font-bold text-[#1a3860] block truncate">
                      {pickupAddress || "Ma position GPS"}
                    </span>
                  </div>
                </div>

                <div className="ml-2 w-0.5 h-3 border-l-2 border-dashed border-slate-300" />

                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-[#2d6cb5] flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-400 block text-[10px] uppercase tracking-wider">
                      Destination
                    </span>
                    <span className="font-bold text-[#1a3860] block truncate">
                      {destAddress || "Église Centrale de la Grâce"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <AddressAutocompleteInput
                  label="Lieu de prise en charge"
                  required
                  value={pickupAddress}
                  onChange={(addr, coords) => {
                    setPickupAddress(addr);
                    if (coords) {
                      setLat(coords.lat);
                      setLng(coords.lng);
                    }
                  }}
                  placeholder="Ex : 12 rue Gambetta, Gare..."
                  icon={MapPin}
                  iconColor="text-[#138872]"
                />
                <button
                  type="button"
                  onClick={detectLocation}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#138872] hover:underline"
                >
                  <LocateFixed className="h-3.5 w-3.5" />
                  <span>Utiliser ma position GPS</span>
                </button>
              </div>
            )}
          </div>

          {/* DATE ET PLAGE HORAIRE MODIFIABLE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/90 border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Calendar className="h-3.5 w-3.5 text-[#175276]" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Date</span>
              </div>
              <span className="text-xs font-bold text-[#1a3860]">
                {dateFormatted}
              </span>
            </div>

            {/* Plage horaire modifiable */}
            <div className="p-3.5 rounded-2xl bg-white/90 border border-slate-200/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Clock className="h-3.5 w-3.5 text-[#138872]" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Plage horaire souhaitée
                  </span>
                </div>
                <span className="text-xs font-extrabold text-[#138872]">
                  {formatHourLabel(startHour)} - {formatHourLabel(endHour)}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-xs font-bold text-slate-500">De</span>
                <div className="relative flex-1">
                  <select
                    value={startHour}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setStartHour(val);
                      if (val >= endHour) {
                        setEndHour(Math.min(24, val + 1));
                      }
                    }}
                    className="w-full h-8.5 pl-2.5 pr-6 rounded-xl bg-slate-100/90 border border-slate-200 text-xs font-bold text-[#1a3860] focus:outline-none appearance-none cursor-pointer"
                  >
                    {START_HOURS.map((h) => (
                      <option key={h} value={h}>
                        {formatHourLabel(h)}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 text-[9px]">
                    ▼
                  </div>
                </div>

                <span className="text-xs font-bold text-slate-500">à</span>
                <div className="relative flex-1">
                  <select
                    value={endHour}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setEndHour(val);
                      if (val <= startHour) {
                        setStartHour(Math.max(0, val - 1));
                      }
                    }}
                    className="w-full h-8.5 pl-2.5 pr-6 rounded-xl bg-slate-100/90 border border-slate-200 text-xs font-bold text-[#1a3860] focus:outline-none appearance-none cursor-pointer"
                  >
                    {END_HOURS.filter((h) => h > startHour).map((h) => (
                      <option key={h} value={h}>
                        {formatHourLabel(h)}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 text-[9px]">
                    ▼
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* NOMBRE DE PERSONNES (PAR DÉFAUT 1) */}
          <div className="rounded-3xl glass-card bg-white/90 backdrop-blur-xl p-4 border border-white/95 shadow-2xs space-y-2">
            <label className="text-xs font-bold text-[#1a3860] flex items-center justify-between">
              <span>Nombre de personnes</span>
              <span className="text-[11px] text-[#7d8fa5] font-semibold">
                ({seats} pers.)
              </span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((num) => (
                <button
                  type="button"
                  key={num}
                  onClick={() => setSeats(num)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    seats === num
                      ? "bg-[#138872] text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* NOTE / PRÉCISIONS */}
          <div className="rounded-3xl glass-card bg-white/90 backdrop-blur-xl p-4 border border-white/95 shadow-2xs space-y-1.5">
            <label className="text-xs font-bold text-[#1a3860] flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-[#138872]" />
              <span>Précisions pour les conducteurs (optionnel)</span>
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`Ex : Prêt dès ${paramStartHour.padStart(2, "0")}h devant le bâtiment...`}
              className="w-full rounded-2xl border border-slate-200/80 bg-white/90 p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#138872]/30 focus:border-[#138872] transition-all"
            />
          </div>

          {/* BOUTON DE VALIDATION PROÉMINENT */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#138872] to-[#249e83] text-sm font-bold text-white shadow-lg shadow-[#138872]/25 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 pt-1"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 stroke-[2.5]" />
                <span>Valider mon besoin de trajet</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CreateNeedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#f4f7fb]">
          <Loader2 className="h-7 w-7 animate-spin text-[#138872]" />
        </div>
      }
    >
      <CreateNeedContent />
    </Suspense>
  );
}
