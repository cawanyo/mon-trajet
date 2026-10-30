"use client";

import React, { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/navigation/BottomNav";
import { NotificationBellButton } from "@/components/navigation/NotificationBellButton";
import { useRouter } from "next/navigation";
import {
  Church,
  Users,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Clock,
  UserCheck,
  UserX,
  Loader2,
  Sparkles,
} from "lucide-react";

export default function ManagerHubPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  const members = useQuery(api.users.listMembersManager, token ? { token } : "skip");
  const churchSettings = useQuery(api.settings.getChurchSettings);

  const pendingCount = useMemo(
    () => members?.filter((u) => u.status === "pending").length ?? 0,
    [members]
  );
  const approvedCount = useMemo(
    () => members?.filter((u) => u.status === "approved").length ?? 0,
    [members]
  );
  const rejectedCount = useMemo(
    () => members?.filter((u) => u.status === "rejected").length ?? 0,
    [members]
  );

  if (!user || (user.role !== "manager" && user.role !== "admin")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f7fb] p-6 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-rose-500" />
        <h2 className="text-base font-bold text-[#1a3860]">Accès réservé</h2>
        <p className="text-xs text-[#7d8fa5]">
          Cette section est réservée aux responsables de l'église.
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 rounded-xl bg-[#175276] text-white text-xs font-bold"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  const isLoading = members === undefined || churchSettings === undefined;

  return (
    <div className="relative min-h-dvh bg-[#f4f7fb] text-slate-800 pb-28 select-none overflow-x-hidden">
      {/* Halos d'ambiance glassy */}
      <div className="pointer-events-none fixed -top-24 -right-24 h-96 w-96 rounded-full bg-teal-200/30 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-1/2 -left-28 h-80 w-80 rounded-full bg-blue-100/40 blur-3xl z-0" />

      {/* En-tête Glassy fixe */}
      <div
        className="sticky top-0 z-30 glass-panel bg-white/80 backdrop-blur-2xl border-b border-white/80 px-4 pb-3.5 shadow-xs"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))" }}
      >
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#175276] to-[#249e83] text-white shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-black text-[#1a3860] tracking-tight">
                Espace Gestion
              </h1>
              <p className="text-[11px] text-[#7d8fa5] font-medium">
                Supervision de la communauté paroissiale
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[11px] font-black shadow-xs animate-pulse">
                <Clock className="h-3.5 w-3.5" />
                <span>{pendingCount}</span>
              </span>
            )}
            <NotificationBellButton variant="glass-panel" />
          </div>
        </div>
      </div>

      <div className="relative z-10 p-4 max-w-md mx-auto space-y-4">
        {/* BANNIÈRE D'ALERTE VALIDATION SI EN ATTENTE */}
        {pendingCount > 0 && (
          <div
            onClick={() => router.push("/manager/members")}
            className="cursor-pointer rounded-3xl p-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md active:scale-[0.99] transition-all flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm flex-shrink-0">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-black tracking-tight">
                  {pendingCount} demande{pendingCount > 1 ? "s" : ""} en attente
                </p>
                <p className="text-[11px] text-white/90">
                  Des paroissiens attendent la validation de leur compte
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-white/90 flex-shrink-0" />
          </div>
        )}

        {/* LES 2 BOUTONS / CARTES PRINCIPALES */}
        <div className="space-y-3.5">
          {/* BOUTON 1 : INFORMATIONS ÉGLISE */}
          <div
            onClick={() => router.push("/manager/church")}
            role="button"
            tabIndex={0}
            className="cursor-pointer group rounded-3xl glass-card bg-white/90 hover:bg-white backdrop-blur-xl p-5 border border-white/90 shadow-xs hover:shadow-md transition-all active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e6f4f0] text-[#138872] group-hover:bg-[#138872] group-hover:text-white transition-all shadow-xs">
                  <Church className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black text-[#1a3860] group-hover:text-[#138872] transition-colors">
                      Informations église
                    </h2>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#138872] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Lieu de culte
                    </span>
                  </div>
                  <p className="text-xs text-[#7d8fa5] mt-0.5">
                    Consulter et modifier l'adresse et le nom de l'église
                  </p>
                </div>
              </div>

              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 group-hover:bg-[#138872]/10 text-slate-400 group-hover:text-[#138872] transition-colors flex-shrink-0">
                <ChevronRight className="h-4.5 w-4.5 stroke-[2.5]" />
              </div>
            </div>

            {/* Aperçu rapide de l'église */}
            <div className="mt-4 pt-3.5 border-t border-slate-100/90 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0 text-slate-600">
                <MapPin className="h-3.5 w-3.5 text-[#138872] flex-shrink-0" />
                <span className="font-semibold truncate text-[#1a3860]">
                  {churchSettings?.name || "Église Centrale"}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500 truncate text-[11px]">
                  {churchSettings?.address || "Adresse non configurée"}
                </span>
              </div>
            </div>
          </div>

          {/* BOUTON 2 : MEMBRES */}
          <div
            onClick={() => router.push("/manager/members")}
            role="button"
            tabIndex={0}
            className="cursor-pointer group rounded-3xl glass-card bg-white/90 hover:bg-white backdrop-blur-xl p-5 border border-white/90 shadow-xs hover:shadow-md transition-all active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e6f0fa] text-[#2d6cb5] group-hover:bg-[#2d6cb5] group-hover:text-white transition-all shadow-xs">
                  <Users className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black text-[#1a3860] group-hover:text-[#2d6cb5] transition-colors">
                      Membres
                    </h2>
                    {pendingCount > 0 && (
                      <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                        {pendingCount} en attente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#7d8fa5] mt-0.5">
                    Demandes de validation, membres actuels et membres bloqués
                  </p>
                </div>
              </div>

              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 group-hover:bg-[#2d6cb5]/10 text-slate-400 group-hover:text-[#2d6cb5] transition-colors flex-shrink-0">
                <ChevronRight className="h-4.5 w-4.5 stroke-[2.5]" />
              </div>
            </div>

            {/* 3 badges d'état pour les membres */}
            <div className="mt-4 pt-3.5 border-t border-slate-100/90 grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center justify-center py-2 px-1 rounded-2xl bg-amber-50/80 border border-amber-200/60 text-center">
                <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> En attente
                </span>
                <span className="text-sm font-black text-amber-900 mt-0.5">
                  {isLoading ? "—" : pendingCount}
                </span>
              </div>

              <div className="flex flex-col items-center justify-center py-2 px-1 rounded-2xl bg-emerald-50/80 border border-emerald-200/60 text-center">
                <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                  <UserCheck className="h-3 w-3" /> Actuels
                </span>
                <span className="text-sm font-black text-emerald-900 mt-0.5">
                  {isLoading ? "—" : approvedCount}
                </span>
              </div>

              <div className="flex flex-col items-center justify-center py-2 px-1 rounded-2xl bg-rose-50/80 border border-rose-200/60 text-center">
                <span className="text-[10px] font-bold text-rose-800 flex items-center gap-1">
                  <UserX className="h-3 w-3" /> Bloqués
                </span>
                <span className="text-sm font-black text-rose-900 mt-0.5">
                  {isLoading ? "—" : rejectedCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* VUE D'ENSEMBLE RAPIDE / CONSEILS MANAGER */}
        <div className="rounded-3xl glass-card bg-white/70 backdrop-blur-xl p-4 border border-white/80 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1a3860]">
            <Sparkles className="h-4 w-4 text-[#138872]" />
            <span>Rôle du responsable</span>
          </div>
          <p className="text-[11px] leading-relaxed text-[#7d8fa5]">
            En tant que responsable, vous assurez la sécurité du réseau de covoiturage en vérifiant
            les coordonnées des paroissiens et en maintenant à jour l'adresse officielle de l'église
            pour les trajets dominicaux.
          </p>
        </div>
      </div>

      <BottomNav userRole={user?.role ?? "manager"} />
    </div>
  );
}
