"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import {
  Users,
  Car,
  Clock,
  ShieldCheck,
  HeartHandshake,
  ArrowRight,
  ShieldAlert,
  MapPin,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const stats = useQuery(api.users.getAdminStats, token ? { token } : "skip");

  if (stats === undefined) {
    return (
      <div className="flex items-center justify-center py-20 text-xs font-semibold text-slate-400">
        Chargement des indicateurs...
      </div>
    );
  }

  const statCards = [
    {
      title: "Membres inscrits",
      value: stats.totalUsers,
      desc: "Total des comptes créés",
      icon: Users,
      href: "/admin/users",
      iconBg: "bg-slate-100 text-[#1a3860]",
    },
    {
      title: "En attente",
      value: stats.pendingUsers,
      desc: stats.pendingUsers > 0 ? "Demandes à examiner" : "Aucune demande en attente",
      icon: Clock,
      href: "/admin/users?filter=pending",
      iconBg: stats.pendingUsers > 0 ? "bg-amber-50 text-amber-700 border border-amber-200/60" : "bg-slate-100 text-slate-500",
      highlight: stats.pendingUsers > 0,
    },
    {
      title: "Comptes validés",
      value: stats.approvedUsers,
      desc: "Membres actifs autorisés",
      icon: UserCheck,
      href: "/admin/users?filter=approved",
      iconBg: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
    },
    {
      title: "Responsables (Managers)",
      value: stats.managers,
      desc: "Modérateurs de la paroisse",
      icon: ShieldCheck,
      href: "/admin/users?filter=managers",
      iconBg: "bg-sky-50 text-[#175276] border border-sky-200/60",
    },
    {
      title: "Trajets programmés",
      value: stats.activeTrips,
      desc: "Départs actifs sur la carte",
      icon: Car,
      href: "/",
      iconBg: "bg-teal-50 text-teal-700 border border-teal-200/60",
    },
    {
      title: "Covoiturages réalisés",
      value: stats.completedTrips || stats.acceptedRequests,
      desc: "Trajets menés à bien",
      icon: HeartHandshake,
      href: "/",
      iconBg: "bg-indigo-50 text-indigo-700 border border-indigo-200/60",
    },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête sobre et épuré */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#1a3860] tracking-tight">
            Console d'administration
          </h1>
          <p className="text-xs text-[#7d8fa5] mt-0.5">
            Supervision de la communauté et gestion des accès
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/80 border border-slate-200/80 text-slate-600 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Service actif
          </span>
        </div>
      </div>

      {/* Bannière discrète d'action rapide si des comptes sont en attente */}
      {stats.pendingUsers > 0 && (
        <div className="rounded-2xl bg-amber-50/90 border border-amber-200/80 p-4 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800 flex-shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">
                {stats.pendingUsers} inscription{stats.pendingUsers > 1 ? "s" : ""} en attente de vérification
              </p>
              <p className="text-[11px] text-amber-700/90">
                Ces personnes attendent l'approbation d'un responsable pour pouvoir covoiturer.
              </p>
            </div>
          </div>
          <Link
            href="/admin/users?filter=pending"
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <span>Examiner les demandes</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Grille des indicateurs épurée (cartes sobres) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Link
              key={i}
              href={card.href}
              className={`group rounded-2xl bg-white/85 backdrop-blur-xl p-4 border transition-all duration-150 flex items-center justify-between shadow-2xs hover:shadow-sm cursor-pointer ${
                card.highlight
                  ? "border-amber-300/80 bg-amber-50/30 ring-1 ring-amber-200/50"
                  : "border-slate-200/70 hover:border-slate-300"
              }`}
            >
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {card.title}
                </p>
                <div className="text-2xl font-black text-[#1a3860] tracking-tight">
                  {card.value}
                </div>
                <p className="text-[11px] text-slate-400 font-medium">{card.desc}</p>
              </div>

              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl flex-shrink-0 transition-transform group-hover:scale-105 ${card.iconBg}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Raccourcis de gestion épurés */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Carte Gestion des Membres */}
        <div className="rounded-2xl bg-white/85 backdrop-blur-xl p-5 border border-slate-200/70 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#175276]" />
              <h2 className="text-sm font-bold text-[#1a3860]">
                Gestion des Membres & Rôles
              </h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Consultez l'annuaire complet, attribuez le statut Manager ou Administrateur, et modérez les comptes de la communauté.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-2 rounded-xl bg-[#175276] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#134260] active:scale-95 transition-all"
            >
              <span>Accéder à l'annuaire des membres</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Carte Trajets & Carte */}
        <div className="rounded-2xl bg-white/85 backdrop-blur-xl p-5 border border-slate-200/70 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-bold text-[#1a3860]">
                Carte des Trajets en Direct
              </h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Visualisez les trajets programmés par les conducteurs et les demandes de passagers ouvertes sur l'ensemble du réseau.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200/90 px-4 py-2 text-xs font-bold text-[#1a3860] shadow-2xs hover:bg-slate-50 active:scale-95 transition-all"
            >
              <span>Voir la carte interactive</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
