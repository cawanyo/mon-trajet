"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Users, Car, CheckCircle2, Clock, ShieldCheck, HeartHandshake, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const stats = useQuery(api.users.getAdminStats, token ? { token } : "skip");

  if (stats === undefined) {
    return <div className="text-sm text-slate-500">Chargement des statistiques...</div>;
  }

  const statCards = [
    {
      title: "Membres Totaux",
      value: stats.totalUsers,
      desc: "Inscrits sur l'application",
      icon: Users,
      color: "bg-blue-500",
    },
    {
      title: "Comptes en Attente",
      value: stats.pendingUsers,
      desc: "À vérifier par les managers",
      icon: Clock,
      color: "bg-amber-500",
    },
    {
      title: "Membres Validés",
      value: stats.approvedUsers,
      desc: "Autorisés à covoiturer",
      icon: ShieldCheck,
      color: "bg-emerald-500",
    },
    {
      title: "Responsables (Managers)",
      value: stats.managers,
      desc: "Modérateurs de la paroisse",
      icon: ShieldCheck,
      color: "bg-indigo-500",
    },
    {
      title: "Trajets Actifs",
      value: stats.activeTrips,
      desc: "Ouverts sur la carte",
      icon: Car,
      color: "bg-teal-500",
    },
    {
      title: "Places Confirmées",
      value: stats.acceptedRequests,
      desc: "Covoiturages réalisés",
      icon: HeartHandshake,
      color: "bg-rose-500",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Tableau de bord de l'Église
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Vue d'ensemble de l'activité du covoiturage solidaire
        </p>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {card.title}
                </p>
                <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                  {card.value}
                </div>
                <p className="text-xs text-slate-400 mt-1">{card.desc}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white ${card.color}`}>
                <Icon className="h-6 w-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Raccourci vers la gestion des utilisateurs */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Gestion des Rôles & Modération
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Nommer des managers, modifier les privilèges ou bannir un compte.
          </p>
        </div>
        <Link
          href="/admin/users"
          className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow hover:bg-indigo-500 transition-all"
        >
          <span>Gérer les membres</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
