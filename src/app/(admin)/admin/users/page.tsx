"use client";

import React, { useState, Suspense, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "../../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { VerifiedTicker } from "@/components/ui/VerifiedTicker";
import { useToast } from "@/components/ui/ToastProvider";
import {
  Search,
  Shield,
  User,
  Phone,
  Mail,
  Loader2,
  Check,
  X,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  Filter,
} from "lucide-react";

type FilterType = "all" | "pending" | "approved" | "rejected" | "managers";

function AdminUsersContent() {
  const { token, user: currentUser } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const initialFilter = (searchParams.get("filter") as FilterType) || "all";
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const users = useQuery(api.users.listAllUsersAdmin, token ? { token } : "skip");
  const changeRole = useMutation(api.users.changeUserRole);
  const reviewStatus = useMutation(api.users.reviewUserStatus);

  // Filtrage combiné (Recherche texte + Onglet de statut/rôle)
  const filteredUsers = useMemo(() => {
    if (!users) return [];

    return users.filter((u) => {
      // 1. Filtre par texte (nom, email, téléphone)
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phoneNumber && u.phoneNumber.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // 2. Filtre par onglet
      if (filter === "pending") return u.status === "pending";
      if (filter === "approved") return u.status === "approved";
      if (filter === "rejected") return u.status === "rejected";
      if (filter === "managers") return u.role === "manager" || u.role === "admin";
      return true;
    });
  }, [users, search, filter]);

  // Statistiques de comptage pour les onglets
  const counts = useMemo(() => {
    if (!users) return { all: 0, pending: 0, approved: 0, rejected: 0, managers: 0 };
    return {
      all: users.length,
      pending: users.filter((u) => u.status === "pending").length,
      approved: users.filter((u) => u.status === "approved").length,
      rejected: users.filter((u) => u.status === "rejected").length,
      managers: users.filter((u) => u.role === "manager" || u.role === "admin").length,
    };
  }, [users]);

  const handleRoleChange = async (userId: string, newRole: "user" | "manager" | "admin") => {
    if (!token) return;
    setProcessingId(userId);
    try {
      await changeRole({ token, userId: userId as any, role: newRole });
      const roleLabel =
        newRole === "admin" ? "Administrateur" : newRole === "manager" ? "Responsable" : "Utilisateur";
      toast.success(`Rôle mis à jour : ${roleLabel}`);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du changement de rôle");
    } finally {
      setProcessingId(null);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: "approved" | "rejected") => {
    if (!token) return;
    setProcessingId(userId);
    try {
      await reviewStatus({ token, userId: userId as any, status: newStatus });
      toast.success(newStatus === "approved" ? "Compte validé avec succès." : "Compte suspendu.");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour du statut");
    } finally {
      setProcessingId(null);
    }
  };

  if (users === undefined) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-[#175276]" />
      </div>
    );
  }

  const filterTabs: { id: FilterType; label: string; count: number; alert?: boolean }[] = [
    { id: "all", label: "Tous", count: counts.all },
    { id: "pending", label: "En attente", count: counts.pending, alert: counts.pending > 0 },
    { id: "approved", label: "Validés", count: counts.approved },
    { id: "rejected", label: "Refusés", count: counts.rejected },
    { id: "managers", label: "Responsables & Admins", count: counts.managers },
  ];

  return (
    <div className="space-y-5">
      {/* En-tête sobre */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#1a3860] tracking-tight">
            Membres & Droits d'accès
          </h1>
          <p className="text-xs text-[#7d8fa5] mt-0.5">
            {counts.all} membre{counts.all > 1 ? "s" : ""} enregistré{counts.all > 1 ? "s" : ""} dans la communauté
          </p>
        </div>

        {/* Barre de recherche sobre */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher nom, email..."
            className="w-full rounded-xl bg-white/90 border border-slate-200/80 pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#175276]/30 shadow-2xs transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Onglets de filtrage sobres */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {filterTabs.map((tab) => {
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-[#175276] text-white shadow-2xs"
                  : "bg-white/80 border border-slate-200/80 text-slate-600 hover:text-[#1a3860] hover:bg-white"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : tab.alert
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* État vide si aucun résultat */}
      {filteredUsers.length === 0 && (
        <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-slate-200/80 p-10 text-center space-y-2 shadow-2xs">
          <Filter className="h-7 w-7 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-700">Aucun membre trouvé</p>
          <p className="text-[11px] text-slate-400">
            {search ? `Aucun résultat pour "${search}"` : "Aucun membre ne correspond à ce filtre."}
          </p>
        </div>
      )}

      {/* Vue Mobile (Cards) - md:hidden */}
      <div className="md:hidden space-y-3">
        {filteredUsers.map((u) => {
          const isCurrentUser = currentUser?._id === u._id;
          const isProcessing = processingId === u._id;

          return (
            <div
              key={u._id}
              className="rounded-2xl bg-white/85 backdrop-blur-xl border border-slate-200/80 p-4 shadow-2xs space-y-3"
            >
              {/* Entête membre */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-[#1a3860] font-black text-xs flex-shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-xs text-[#1a3860]">
                      <span>{u.name}</span>
                      <VerifiedTicker status={u.status} size="xs" />
                      {isCurrentUser && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">
                          Vous
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">{u.email}</p>
                  </div>
                </div>

                {/* Badge Statut */}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    u.status === "approved"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                      : u.status === "pending"
                      ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                      : "bg-rose-50 text-rose-700 border border-rose-200/60"
                  }`}
                >
                  {u.status === "approved"
                    ? "Validé"
                    : u.status === "pending"
                    ? "En attente"
                    : "Refusé"}
                </span>
              </div>

              {/* Coordonnées & Rôle */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">Téléphone</span>
                  <span className="font-mono text-slate-700 font-semibold">{u.phoneNumber || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Rôle attribué</span>
                  <select
                    disabled={isProcessing || isCurrentUser}
                    value={u.role}
                    onChange={(e) => handleRoleChange(u._id, e.target.value as any)}
                    className="w-full mt-0.5 rounded-lg bg-slate-100/90 border border-slate-200 px-2 py-1 text-[11px] font-bold text-[#1a3860] focus:outline-none disabled:opacity-60"
                  >
                    <option value="user">Utilisateur</option>
                    <option value="manager">Responsable</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
              </div>

              {/* Actions de validation */}
              {u.status !== "approved" && (
                <div className="pt-1 flex items-center gap-2">
                  <button
                    disabled={isProcessing}
                    onClick={() => handleStatusChange(u._id, "approved")}
                    className="flex-1 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Approuver</span>
                  </button>
                  {u.status !== "rejected" && (
                    <button
                      disabled={isProcessing}
                      onClick={() => handleStatusChange(u._id, "rejected")}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 text-rose-600 text-xs font-bold hover:bg-rose-50 active:scale-95 transition-all"
                    >
                      Refuser
                    </button>
                  )}
                </div>
              )}
              {u.status === "approved" && !isCurrentUser && (
                <div className="pt-1 flex justify-end">
                  <button
                    disabled={isProcessing}
                    onClick={() => handleStatusChange(u._id, "rejected")}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline"
                  >
                    Suspendre l'accès
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Vue Desktop (Tableau Sobre) - hidden md:block */}
      <div className="hidden md:block overflow-hidden rounded-2xl bg-white/85 backdrop-blur-xl border border-slate-200/80 shadow-2xs">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200/80">
            <tr>
              <th className="px-5 py-3.5">Membre</th>
              <th className="px-5 py-3.5">Téléphone</th>
              <th className="px-5 py-3.5">Rôle</th>
              <th className="px-5 py-3.5">Statut</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/90">
            {filteredUsers.map((u) => {
              const isCurrentUser = currentUser?._id === u._id;
              const isProcessing = processingId === u._id;

              return (
                <tr key={u._id} className="hover:bg-slate-50/50 transition-colors">
                  {/* Membre */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-[#1a3860] font-bold text-xs flex-shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <span>{u.name}</span>
                          <VerifiedTicker status={u.status} size="xs" />
                          {isCurrentUser && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-500 font-bold">
                              Vous
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">{u.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Téléphone */}
                  <td className="px-5 py-3.5 font-mono text-[11px] text-slate-700">
                    {u.phoneNumber || "—"}
                  </td>

                  {/* Rôle */}
                  <td className="px-5 py-3.5">
                    <select
                      disabled={isProcessing || isCurrentUser}
                      value={u.role}
                      onChange={(e) => handleRoleChange(u._id, e.target.value as any)}
                      className="rounded-xl bg-slate-100/90 hover:bg-slate-100 border border-slate-200/80 px-2.5 py-1 text-[11px] font-bold text-[#1a3860] focus:outline-none focus:ring-1 focus:ring-[#175276] cursor-pointer disabled:opacity-60 transition-all"
                    >
                      <option value="user">Utilisateur</option>
                      <option value="manager">Responsable</option>
                      <option value="admin">Administrateur</option>
                    </select>
                  </td>

                  {/* Statut */}
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        u.status === "approved"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : u.status === "pending"
                          ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                          : "bg-rose-50 text-rose-700 border border-rose-200/60"
                      }`}
                    >
                      {u.status === "approved"
                        ? "Validé"
                        : u.status === "pending"
                        ? "En attente"
                        : "Refusé"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {u.status !== "approved" && (
                        <button
                          disabled={isProcessing}
                          onClick={() => handleStatusChange(u._id, "approved")}
                          className="rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100/90 border border-emerald-200/60 px-3 py-1 text-[11px] font-bold active:scale-95 transition-all cursor-pointer"
                        >
                          Approuver
                        </button>
                      )}
                      {u.status !== "rejected" && !isCurrentUser && (
                        <button
                          disabled={isProcessing}
                          onClick={() => handleStatusChange(u._id, "rejected")}
                          className="rounded-xl bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600 px-3 py-1 text-[11px] font-bold active:scale-95 transition-all cursor-pointer"
                        >
                          Suspendre
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminUsersManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-[#175276]" />
        </div>
      }
    >
      <AdminUsersContent />
    </Suspense>
  );
}
