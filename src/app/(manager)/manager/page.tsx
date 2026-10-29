"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/navigation/BottomNav";
import { VerifiedTicker } from "@/components/ui/VerifiedTicker";
import { AddressAutocompleteInput } from "@/components/ui/AddressAutocompleteInput";
import { useToast } from "@/components/ui/ToastProvider";
import {
  Check,
  X,
  ShieldAlert,
  User,
  Phone,
  Mail,
  Loader2,
  Church,
  Save,
  MapPin,
} from "lucide-react";

export default function ManagerValidationPage() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const pendingUsers = useQuery(api.users.listPendingUsers, token ? { token } : "skip");
  const reviewUser = useMutation(api.users.reviewUserStatus);

  // Paramètres de l'église
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

  if (pendingUsers === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8fafc]">
        <Loader2 className="h-6 w-6 animate-spin text-[#2d6cb5]" />
      </div>
    );
  }

  const handleDecision = async (userId: string, status: "approved" | "rejected") => {
    if (!token) return;
    try {
      await reviewUser({ token, userId: userId as any, status });
      toast.success(status === "approved" ? "Membre validé !" : "Demande refusée.");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la décision");
    }
  };

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
      toast.success("Adresse de l'église mise à jour !");
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setIsSavingChurch(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 p-4 max-w-lg mx-auto text-slate-800 space-y-5">
      {/* 1. SECTION ADRESSE DE L'ÉGLISE (CONFIGURÉE PAR LE MANAGER) */}
      <div className="rounded-3xl bg-white p-4 sm:p-5 shadow-xs border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e6f4f0] text-[#38917d]">
              <Church className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1a3860]">Adresse de l'Église</h2>
              <p className="text-[11px] text-[#7d8fa5]">Sélectionnée par défaut pour tous les trajets</p>
            </div>
          </div>
          {saveSuccess && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-xl">
              <Check className="h-3.5 w-3.5" /> Enregistré
            </span>
          )}
        </div>

        <form onSubmit={handleSaveChurch} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Nom de l'église
            </label>
            <input
              type="text"
              required
              value={churchName}
              onChange={(e) => setChurchName(e.target.value)}
              placeholder="Ex : Église Centrale de la Grâce"
              className="w-full rounded-2xl bg-slate-50 border border-slate-200/90 py-2.5 px-3.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#38917d]/30 focus:border-[#38917d]"
            />
          </div>

          <div>
            <AddressAutocompleteInput
              label="Adresse physique (avec suggestions)"
              required
              value={churchAddress}
              onChange={(addr, coords) => {
                setChurchAddress(addr);
                if (coords) setChurchCoords(coords);
              }}
              placeholder="Rechercher l'adresse de l'église..."
              icon={MapPin}
              iconColor="text-[#38917d]"
            />
          </div>

          <button
            type="submit"
            disabled={isSavingChurch}
            className="flex items-center justify-center gap-2 w-full rounded-2xl bg-[#38917d] hover:bg-[#2e7d6b] py-2.5 text-xs font-bold text-white shadow-xs transition-all disabled:opacity-50"
          >
            {isSavingChurch ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Enregistrer l'adresse de l'église</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* 2. SECTION VALIDATION DES MEMBRES */}
      <div>
        <div className="mb-4">
          <h1 className="text-xl font-bold text-[#1a3860]">Validation des membres</h1>
          <p className="text-xs text-[#7d8fa5] mt-0.5">
            {pendingUsers.length} profil(s) en attente d'approbation
          </p>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-center text-xs text-slate-500 border border-slate-200/80">
            Aucun compte en attente de validation pour le moment.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingUsers.map((item) => (
              <div
                key={item._id}
                className="rounded-3xl bg-white p-4 shadow-xs border border-slate-200/80"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e6f0fa] text-[#2d6cb5] font-bold">
                    {item.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                      <VerifiedTicker status={item.status} size="xs" />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{item.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Phone className="h-3.5 w-3.5 text-emerald-600" />
                      <span>{item.phoneNumber}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 flex gap-2">
                  <button
                    onClick={() => handleDecision(item._id, "rejected")}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-slate-100 py-2.5 text-xs font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-all"
                  >
                    <X className="h-4 w-4" />
                    <span>Refuser</span>
                  </button>
                  <button
                    onClick={() => handleDecision(item._id, "approved")}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-[#2d6cb5] py-2.5 text-xs font-bold text-white hover:bg-[#255ea0] shadow-xs transition-all"
                  >
                    <Check className="h-4 w-4" />
                    <span>Approuver</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav userRole={user?.role ?? "manager"} />
    </div>
  );
}
