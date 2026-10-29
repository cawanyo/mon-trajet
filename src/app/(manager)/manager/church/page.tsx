"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/navigation/BottomNav";
import { AddressAutocompleteInput } from "@/components/ui/AddressAutocompleteInput";
import { useToast } from "@/components/ui/ToastProvider";
import { useRouter } from "next/navigation";
import {
  Church,
  Save,
  MapPin,
  ChevronLeft,
  Check,
  Loader2,
  ShieldAlert,
} from "lucide-react";

export default function ManagerChurchPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const churchSettings = useQuery(api.settings.getChurchSettings);
  const updateChurchSettings = useMutation(api.settings.updateChurchSettings);

  const [churchName, setChurchName] = useState("");
  const [churchAddress, setChurchAddress] = useState("");
  const [churchCoords, setChurchCoords] = useState<{ lat: number; lng: number }>({
    lat: 48.8566,
    lng: 2.3522,
  });
  const [isSavingChurch, setIsSavingChurch] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (churchSettings) {
      setChurchName(churchSettings.name);
      setChurchAddress(churchSettings.address);
      setChurchCoords({ lat: churchSettings.lat, lng: churchSettings.lng });
    }
  }, [churchSettings]);

  if (!user || (user.role !== "manager" && user.role !== "admin")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f7fb] p-6 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-rose-500" />
        <h2 className="text-base font-bold text-[#1a3860]">Accès réservé</h2>
        <p className="text-xs text-[#7d8fa5]">Cette section est réservée aux responsables de l'église.</p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 rounded-xl bg-[#175276] text-white text-xs font-bold"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  const handleSaveChurch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSavingChurch(true);
    setSaveSuccess(false);
    try {
      await updateChurchSettings({
        token,
        name: churchName,
        address: churchAddress,
        lat: churchCoords.lat,
        lng: churchCoords.lng,
      });
      setSaveSuccess(true);
      toast.success("Informations de l'église enregistrées avec succès !");
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setIsSavingChurch(false);
    }
  };

  return (
    <div className="relative min-h-dvh bg-[#f4f7fb] text-slate-800 pb-28 select-none overflow-x-hidden">
      {/* Halos d'ambiance glassy */}
      <div className="pointer-events-none fixed -top-24 -right-24 h-96 w-96 rounded-full bg-teal-200/30 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-1/2 -left-28 h-80 w-80 rounded-full bg-blue-100/40 blur-3xl z-0" />

      {/* En-tête Glassy fixe */}
      <div
        className="sticky top-0 z-30 glass-panel bg-white/80 backdrop-blur-2xl border-b border-white/80 px-4 pb-3 shadow-xs"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))" }}
      >
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/manager")}
              className="flex h-9 w-9 items-center justify-center rounded-2xl glass-card bg-white/90 text-[#1a3860] hover:bg-white active:scale-95 transition-all shadow-2xs border border-white/90"
              title="Retour à l'espace gestion"
            >
              <ChevronLeft className="h-5 w-5 stroke-[2.4]" />
            </button>
            <div>
              <h1 className="text-base font-black text-[#1a3860] tracking-tight">Informations Église</h1>
              <p className="text-[11px] text-[#7d8fa5] font-medium">Point de convergence des trajets</p>
            </div>
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#e6f4f0] text-[#138872]">
            <Church className="h-4.5 w-4.5" />
          </div>
        </div>
      </div>

      <div className="relative z-10 p-4 max-w-md mx-auto space-y-4">
        {/* CARTE DE PRÉSENTATION ACTUELLE */}
        <div className="rounded-3xl glass-card bg-white/90 backdrop-blur-xl p-5 border border-white/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#138872] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Configuration Active
            </span>
            {saveSuccess && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full animate-in fade-in">
                <Check className="h-3 w-3" /> Mis à jour
              </span>
            )}
          </div>

          <div>
            <h2 className="text-base font-extrabold text-[#1a3860]">
              {churchSettings?.name || "Église Centrale"}
            </h2>
            <p className="text-xs text-slate-600 mt-1 flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#138872] flex-shrink-0 mt-0.5" />
              <span>{churchSettings?.address || "Aucune adresse configurée pour le moment"}</span>
            </p>
          </div>
        </div>

        {/* FORMULAIRE DE MODIFICATION */}
        <div className="rounded-3xl glass-card bg-white/90 backdrop-blur-xl p-5 border border-white/90 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1a3860]">
            Modifier les coordonnées
          </h3>

          <form onSubmit={handleSaveChurch} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom officiel de l'église
              </label>
              <input
                type="text"
                required
                value={churchName}
                onChange={(e) => setChurchName(e.target.value)}
                placeholder="Ex : Église Centrale de la Grâce"
                className="w-full rounded-2xl bg-slate-50/90 border border-slate-200/90 py-3 px-3.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#138872]/30 focus:border-[#138872]"
              />
            </div>

            <div>
              <AddressAutocompleteInput
                label="Adresse postale exacte"
                required
                value={churchAddress}
                onChange={(addr, coords) => {
                  setChurchAddress(addr);
                  if (coords) setChurchCoords(coords);
                }}
                placeholder="Rechercher l'adresse de l'église..."
                icon={MapPin}
                iconColor="text-[#138872]"
              />
              <p className="text-[10px] text-slate-400 mt-1.5 pl-1">
                Cette adresse est utilisée automatiquement comme destination finale ou point de départ pour l'ensemble des covoiturages.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSavingChurch}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] text-white text-xs sm:text-sm font-bold shadow-md shadow-[#1b7f80]/20 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSavingChurch ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Enregistrer les modifications</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <BottomNav userRole={user.role} />
    </div>
  );
}
