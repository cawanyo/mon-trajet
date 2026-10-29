"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { VerifiedTicker } from "@/components/ui/VerifiedTicker";
import { useToast } from "@/components/ui/ToastProvider";
import { Search, Shield, User, Check, X, Phone, Mail, Loader2 } from "lucide-react";

export default function AdminUsersManagementPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const users = useQuery(api.users.listAllUsersAdmin, token ? { token } : "skip");
  const changeRole = useMutation(api.users.changeUserRole);
  const reviewStatus = useMutation(api.users.reviewUserStatus);

  const [search, setSearch] = useState("");

  if (users === undefined) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.phoneNumber.includes(search)
  );

  const handleRoleChange = async (userId: string, newRole: "user" | "manager" | "admin") => {
    if (!token) return;
    try {
      await changeRole({ token, userId: userId as any, role: newRole });
      toast.success("Rôle mis à jour !");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du changement de rôle");
    }
  };

  const handleStatusChange = async (userId: string, newStatus: "approved" | "rejected") => {
    if (!token) return;
    try {
      await reviewStatus({ token, userId: userId as any, status: newStatus });
      toast.success(newStatus === "approved" ? "Utilisateur approuvé !" : "Utilisateur refusé.");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du changement de statut");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Gestion des Membres
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {users.length} utilisateur(s) enregistré(s)
          </p>
        </div>

        {/* Barre de recherche */}
        <div className="relative w-72">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email..."
            className="w-full rounded-2xl bg-white dark:bg-slate-900 pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Tableau Desktop */}
      <div className="overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-4">Utilisateur</th>
              <th className="px-6 py-4">Téléphone</th>
              <th className="px-6 py-4">Rôle</th>
              <th className="px-6 py-4">Statut</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((u) => (
              <tr key={u._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 font-bold">
                      {u.name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                        <span>{u.name}</span>
                        <VerifiedTicker status={u.status} size="xs" />
                      </div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                  {u.phoneNumber}
                </td>

                <td className="px-6 py-4">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u._id, e.target.value as any)}
                    className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="user">Utilisateur (USER)</option>
                    <option value="manager">Responsable (MANAGER)</option>
                    <option value="admin">Administrateur (ADMIN)</option>
                  </select>
                </td>

                <td className="px-6 py-4">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                      u.status === "approved"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : u.status === "pending"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                    }`}
                  >
                    {u.status === "approved"
                      ? "Validé"
                      : u.status === "pending"
                      ? "En attente"
                      : "Refusé"}
                  </span>
                </td>

                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {u.status !== "approved" && (
                      <button
                        onClick={() => handleStatusChange(u._id, "approved")}
                        className="rounded-xl bg-emerald-50 dark:bg-emerald-950 px-3 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-100"
                      >
                        Approuver
                      </button>
                    )}
                    {u.status !== "rejected" && (
                      <button
                        onClick={() => handleStatusChange(u._id, "rejected")}
                        className="rounded-xl bg-rose-50 dark:bg-rose-950 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100"
                      >
                        Suspendre
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
