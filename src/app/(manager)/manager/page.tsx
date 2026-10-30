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
  ShieldAlert,
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
      {/* Halos d'ambiance glassy subtils */}
      <div className="pointer-events-none fixed -top-24 -right-24 h-96 w-96 rounded-full bg-teal-200/20 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-1/2 -left-28 h-80 w-80 rounded-full bg-blue-100/30 blur-3xl z-0" />

      {/* En-tête fixe épuré */}
      <div
        className="sticky top-0 z-30 glass-panel bg-white/80 backdrop-blur-2xl border-b border-white/80 px-4 pb-3 shadow-xs"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))" }}
      >
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-[#1a3860] tracking-tight">
              Gestion
            </h1>
            <p className="text-[11px] text-[#7d8fa5] font-medium">
              {churchSettings?.name || "Paroisse"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBellButton variant="glass-panel" />
          </div>
        </div>
      </div>

      <div className="relative z-10 p-4 max-w-md mx-auto space-y-3.5">
        {/* Alerte discrète si validations en attente */}
        {pendingCount > 0 && (
          <button
            onClick={() => router.push("/manager/members?tab=pending")}
            className="w-full rounded-2xl bg-amber-50/90 border border-amber-200/80 px-3.5 py-2.5 flex items-center justify-between text-xs text-amber-900 shadow-2xs hover:bg-amber-100/70 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2 font-bold">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>{pendingCount} demande{pendingCount > 1 ? "s" : ""} en attente de validation</span>
            </div>
            <ChevronRight className="h-4 w-4 text-amber-700" />
          </button>
        )}

        {/* Indicateurs clés sobres et cliquables */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => router.push("/manager/members?tab=pending")}
            className={`rounded-2xl p-2.5 text-center border transition-all cursor-pointer shadow-2xs ${
              pendingCount > 0
                ? "bg-amber-50/70 border-amber-200/80 hover:bg-amber-100/60"
                : "bg-white border-slate-200/70 hover:bg-slate-50"
            }`}
          >
            <span className="text-[10px] font-bold text-slate-500 block">En attente</span>
            <span
              className={`text-base font-black mt-0.5 block ${
                pendingCount > 0 ? "text-amber-600" : "text-slate-700"
              }`}
            >
              {isLoading ? "—" : pendingCount}
            </span>
          </button>

          <button
            onClick={() => router.push("/manager/members?tab=approved")}
            className="rounded-2xl bg-white p-2.5 text-center border border-slate-200/70 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
          >
            <span className="text-[10px] font-bold text-slate-500 block">Validés</span>
            <span className="text-base font-black text-[#138872] mt-0.5 block">
              {isLoading ? "—" : approvedCount}
            </span>
          </button>

          <button
            onClick={() => router.push("/manager/members?tab=rejected")}
            className="rounded-2xl bg-white p-2.5 text-center border border-slate-200/70 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
          >
            <span className="text-[10px] font-bold text-slate-500 block">Bloqués</span>
            <span className="text-base font-black text-slate-600 mt-0.5 block">
              {isLoading ? "—" : rejectedCount}
            </span>
          </button>
        </div>

        {/* Cartes d'accès direct sobres */}
        <div className="space-y-2.5 pt-1">
          {/* Membres */}
          <div
            onClick={() => router.push("/manager/members")}
            role="button"
            tabIndex={0}
            className="cursor-pointer group rounded-2xl bg-white hover:bg-slate-50/80 p-3.5 border border-slate-200/80 shadow-2xs transition-all active:scale-[0.99] flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#175276] flex-shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-[#1a3860]">
                  Gestion des membres
                </h2>
                <p className="text-[11px] text-slate-500 truncate">
                  {approvedCount} validé{approvedCount > 1 ? "s" : ""}
                  {pendingCount > 0 && ` • ${pendingCount} en attente`}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#175276] transition-colors flex-shrink-0" />
          </div>

          {/* Lieu de culte */}
          <div
            onClick={() => router.push("/manager/church")}
            role="button"
            tabIndex={0}
            className="cursor-pointer group rounded-2xl bg-white hover:bg-slate-50/80 p-3.5 border border-slate-200/80 shadow-2xs transition-all active:scale-[0.99] flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-[#138872] flex-shrink-0">
                <Church className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-[#1a3860]">
                  Lieu de culte
                </h2>
                <p className="text-[11px] text-slate-500 truncate">
                  {churchSettings?.name || "Église"} • {churchSettings?.address || "Configurer l'adresse"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#138872] transition-colors flex-shrink-0" />
          </div>
        </div>
      </div>

      <BottomNav userRole={user?.role ?? "manager"} />
    </div>
  );
}
