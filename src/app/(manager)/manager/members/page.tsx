"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/navigation/BottomNav";
import { VerifiedTicker } from "@/components/ui/VerifiedTicker";
import { useToast } from "@/components/ui/ToastProvider";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  Phone,
  Mail,
  Check,
  X,
  ShieldAlert,
  Loader2,
  ChevronLeft,
  UserCheck,
  UserX,
  Clock,
  Ban,
  Shield,
} from "lucide-react";

export default function ManagerMembersPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const { toast, confirm } = useToast();

  const allUsers = useQuery(api.users.listMembersManager, token ? { token } : "skip");
  const reviewUser = useMutation(api.users.reviewUserStatus);

  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingMembers = useMemo(
    () => allUsers?.filter((u) => u.status === "pending") ?? [],
    [allUsers]
  );
  const approvedMembers = useMemo(
    () => allUsers?.filter((u) => u.status === "approved") ?? [],
    [allUsers]
  );
  const rejectedMembers = useMemo(
    () => allUsers?.filter((u) => u.status === "rejected") ?? [],
    [allUsers]
  );

  const currentTabList = useMemo(() => {
    let list =
      activeTab === "pending"
        ? pendingMembers
        : activeTab === "approved"
        ? approvedMembers
        : rejectedMembers;

    if (!search.trim()) return list;

    const q = search.toLowerCase();
    return list.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.phoneNumber?.includes(q)
    );
  }, [activeTab, pendingMembers, approvedMembers, rejectedMembers, search]);

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

  const handleDecision = async (
    userId: string,
    status: "approved" | "rejected",
    userName: string
  ) => {
    if (!token) return;

    if (status === "rejected" && activeTab === "approved") {
      const ok = await confirm({
        title: "Bloquer ce membre ?",
        message: `Souhaitez-vous vraiment bloquer l'accès de ${userName} au covoiturage de l'église ?`,
        confirmText: "Oui, bloquer",
        cancelText: "Annuler",
        destructive: true,
      });
      if (!ok) return;
    }

    setProcessingId(userId);
    try {
      await reviewUser({
        token,
        userId: userId as any,
        status,
      });
      toast.success(
        status === "approved"
          ? `${userName} a été validé !`
          : `${userName} a été bloqué / refusé.`
      );
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="relative min-h-dvh bg-[#f4f7fb] text-slate-800 pb-28 select-none overflow-x-hidden">
      {/* Halos d'ambiance glassy */}
      <div className="pointer-events-none fixed -top-24 -right-24 h-96 w-96 rounded-full bg-blue-200/30 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-1/2 -left-28 h-80 w-80 rounded-full bg-teal-100/40 blur-3xl z-0" />

      {/* En-tête Glassy fixe */}
      <div
        className="sticky top-0 z-30 glass-panel bg-white/85 backdrop-blur-2xl border-b border-white/80 px-4 pb-3 shadow-xs space-y-3"
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
              <h1 className="text-base font-black text-[#1a3860] tracking-tight">Gestion des Membres</h1>
              <p className="text-[11px] text-[#7d8fa5] font-medium">Communauté paroissiale</p>
            </div>
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#e6f0fa] text-[#2d6cb5]">
            <Users className="h-4.5 w-4.5" />
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="max-w-md mx-auto relative">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email ou téléphone..."
            className="w-full rounded-2xl bg-white/80 backdrop-blur-md pl-10 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 border border-white/90 focus:outline-none focus:ring-2 focus:ring-[#2d6cb5]/30 focus:border-[#2d6cb5] shadow-xs"
          />
        </div>

        {/* Onglets 3 statuts : En attente | Membres actuels | Bloqués */}
        <div className="max-w-md mx-auto flex rounded-2xl bg-slate-100/90 p-1 border border-white/60">
          <button
            onClick={() => setActiveTab("pending")}
            className={`flex-1 py-1.5 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "pending"
                ? "bg-white text-[#1a3860] shadow-xs"
                : "text-[#6e8298] hover:text-[#1a3860]"
            }`}
          >
            <span>En attente</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === "pending"
                  ? "bg-amber-500 text-white"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {pendingMembers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("approved")}
            className={`flex-1 py-1.5 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "approved"
                ? "bg-white text-[#1a3860] shadow-xs"
                : "text-[#6e8298] hover:text-[#1a3860]"
            }`}
          >
            <span>Actuels</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === "approved"
                  ? "bg-emerald-500 text-white"
                  : "bg-emerald-100 text-[#138872]"
              }`}
            >
              {approvedMembers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("rejected")}
            className={`flex-1 py-1.5 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "rejected"
                ? "bg-white text-[#1a3860] shadow-xs"
                : "text-[#6e8298] hover:text-[#1a3860]"
            }`}
          >
            <span>Bloqués</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === "rejected"
                  ? "bg-rose-500 text-white"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              {rejectedMembers.length}
            </span>
          </button>
        </div>
      </div>

      {/* CONTENU : LISTE DES MEMBRES */}
      <div className="relative z-10 p-4 max-w-md mx-auto space-y-3">
        {allUsers === undefined ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#2d6cb5]" />
          </div>
        ) : currentTabList.length === 0 ? (
          <div className="rounded-3xl glass-card bg-white/85 backdrop-blur-xl p-8 text-center border border-white/90 space-y-2 shadow-xs">
            {activeTab === "pending" ? (
              <>
                <Clock className="h-8 w-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold text-[#1a3860]">Aucune demande en attente</p>
                <p className="text-[11px] text-[#7d8fa5]">
                  Toutes les inscriptions ont été traitées.
                </p>
              </>
            ) : activeTab === "approved" ? (
              <>
                <UserCheck className="h-8 w-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold text-[#1a3860]">Aucun membre validé</p>
                <p className="text-[11px] text-[#7d8fa5]">
                  Les membres approuvés apparaîtront dans cette liste.
                </p>
              </>
            ) : (
              <>
                <UserX className="h-8 w-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold text-[#1a3860]">Aucun membre bloqué</p>
                <p className="text-[11px] text-[#7d8fa5]">
                  Les comptes refusés ou suspendus s'afficheront ici.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {currentTabList.map((member) => {
              const isProcessing = processingId === member._id;

              return (
                <div
                  key={member._id}
                  className="rounded-3xl glass-card bg-white/90 hover:bg-white/95 backdrop-blur-xl p-4 shadow-xs border border-white/90 space-y-3 transition-all"
                >
                  {/* Ligne Profil & Bouton Appel */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#175276] to-[#249e83] text-white font-black text-sm shadow-xs overflow-hidden">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>{member.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-xs sm:text-sm font-bold text-[#1a3860] truncate">
                            {member.name}
                          </h3>
                          <VerifiedTicker status={member.status} size="xs" />
                          {member.role === "manager" && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                              Responsable
                            </span>
                          )}
                          {member.role === "admin" && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                              Admin
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 truncate">
                          <Mail className="h-3 w-3 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 mt-0.5">
                          <Phone className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                          <span>{member.phoneNumber || "Numéro non renseigné"}</span>
                        </div>
                      </div>
                    </div>

                    {/* BOUTON APPEL IMMÉDIAT À CÔTÉ DE LA CARTE */}
                    {member.phoneNumber && (
                      <a
                        href={`tel:${member.phoneNumber}`}
                        className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
                        title={`Appeler ${member.name}`}
                      >
                        <Phone className="h-3.5 w-3.5 fill-white" />
                        <span className="hidden sm:inline">Appeler</span>
                      </a>
                    )}
                  </div>

                  {/* Actions de statut */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    {activeTab === "pending" ? (
                      <>
                        <button
                          onClick={() => handleDecision(member._id, "rejected", member.name)}
                          disabled={isProcessing}
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Refuser</span>
                        </button>
                        <button
                          onClick={() => handleDecision(member._id, "approved", member.name)}
                          disabled={isProcessing}
                          className="flex-1 py-2 px-3 rounded-xl bg-[#138872] hover:bg-[#0f6c5b] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          <span>Approuver</span>
                        </button>
                      </>
                    ) : activeTab === "approved" ? (
                      <button
                        onClick={() => handleDecision(member._id, "rejected", member.name)}
                        disabled={isProcessing || member._id === user._id}
                        className="w-full py-2 px-3 rounded-xl border border-rose-200/80 bg-rose-50/70 hover:bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        <span>Bloquer ce membre</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDecision(member._id, "approved", member.name)}
                        disabled={isProcessing}
                        className="w-full py-2 px-3 rounded-xl bg-[#138872] hover:bg-[#0f6c5b] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        <span>Débloquer et Approuver</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav userRole={user.role} />
    </div>
  );
}
