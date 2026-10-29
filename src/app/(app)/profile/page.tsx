"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { BottomNav } from "@/components/navigation/BottomNav";
import { VerifiedTicker } from "@/components/ui/VerifiedTicker";
import {
  Settings,
  User,
  Car,
  Compass,
  HelpCircle,
  LogOut,
  ChevronRight,
  Loader2,
  Shield,
  ExternalLink,
} from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, logout } = useAuth();

  const profileStats = useQuery(
    api.users.getMyProfileStats,
    token ? { token } : "skip"
  );

  const handleLogout = async () => {
    if (window.confirm("Voulez-vous vraiment vous déconnecter ?")) {
      await logout();
      router.push("/login");
    }
  };

  const displayName = user?.name || "Mon Compte";
  const avatarUrl = user?.avatarUrl;

  return (
    <div className="relative min-h-screen bg-[#f4f7fb] text-slate-800 pb-24 select-none overflow-x-hidden">
      {/* 1. SECTION SUPÉRIEURE : BANNIÈRE PAYSAGE & AVATAR (CONFORME À LA MAQUETTE) */}
      <div className="relative h-64 w-full overflow-hidden bg-slate-900">
        {/* Image de fond : Paysage / coucher de soleil vers l'église */}
        <img
          src="/images/profile-bg.jpg"
          alt="Bannière profil"
          className="h-full w-full object-cover object-center opacity-85 brightness-95"
        />

        {/* Dégradé doux pour lisibilité */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

        {/* Bouton Paramètres en haut à droite (roue crantée blanche dans cercle translucide) */}
        <div className="absolute top-4 right-4 z-20">
          <Link
            href="/profile/settings"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-all shadow-sm active:scale-95"
            title="Paramètres"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>

        {/* Contenu centré : Avatar + Nom + Mention (sans le mot conducteur) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2 z-10 text-center">
          {/* Avatar avec anneau blanc */}
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full ring-4 ring-white/90 shadow-xl overflow-hidden bg-slate-100 flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl font-black text-[#175276]">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Nom du membre avec Ticker de vérification */}
          <div className="mt-2.5 flex items-center justify-center gap-1.5">
            <h1 className="text-lg font-bold text-white drop-shadow-sm">
              {displayName}
            </h1>
            <VerifiedTicker status={user?.status} size="sm" />
          </div>

          {/* Sous-titre : Membre de l'église (respect strict de la consigne : pas le mot conducteur) */}
          <p className="text-xs font-medium text-white/85 drop-shadow-xs mt-0.5">
            Membre de l'église
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4">
        {/* 2. CARTE STATS BLANCHE RECOUVRANTE : "Trajets publiés", "Trajets reçus" */}
        <div className="-mt-6 relative z-20 rounded-3xl glass-card bg-white p-4 shadow-sm border border-slate-100 grid grid-cols-2 divide-x divide-slate-100 text-center">
          {/* Colonne 1 : Trajets publiés */}
          <div className="px-2 space-y-0.5">
            <p className="text-base font-extrabold text-[#1a3860]">
              {profileStats ? profileStats.tripsPublishedCount : "0"}
            </p>
            <p className="text-[11px] font-bold text-[#7d8fa5] leading-tight">
              Trajets publiés
            </p>
          </div>

          {/* Colonne 2 : Trajets reçus */}
          <div className="px-2 space-y-0.5">
            <p className="text-base font-extrabold text-[#1a3860]">
              {profileStats ? profileStats.tripsReceivedCount : "0"}
            </p>
            <p className="text-[11px] font-bold text-[#7d8fa5] leading-tight">
              Trajets reçus
            </p>
          </div>
        </div>

        {/* 3. MENU LIST CARD : Mon profil, Mes trajets, Mes demandes, Paramètres, Aide & support */}
        <div className="mt-4 rounded-3xl glass-card bg-white shadow-xs border border-slate-100 overflow-hidden divide-y divide-slate-100/90">
          {/* 1. Mon profil */}
          <Link
            href="/profile/edit"
            className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/80 active:bg-slate-100/80 transition-colors group"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#175276]">
                <User className="h-4 w-4 stroke-[2.2]" />
              </div>
              <span className="text-xs font-bold text-[#1a3860] group-hover:text-blue-600 transition-colors">
                Mon profil
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </Link>

          {/* 2. Mes trajets */}
          <Link
            href="/trips?tab=driver"
            className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/80 active:bg-slate-100/80 transition-colors group"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-[#138872]">
                <Car className="h-4 w-4 stroke-[2.2]" />
              </div>
              <span className="text-xs font-bold text-[#1a3860] group-hover:text-[#138872] transition-colors">
                Mes trajets
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </Link>

          {/* 3. Mes demandes */}
          <Link
            href="/needs?tab=my"
            className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/80 active:bg-slate-100/80 transition-colors group"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-[#175276]">
                <Compass className="h-4 w-4 stroke-[2.2]" />
              </div>
              <span className="text-xs font-bold text-[#1a3860] group-hover:text-[#175276] transition-colors">
                Mes demandes
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </Link>

          {/* 4. Paramètres */}
          <Link
            href="/profile/settings"
            className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/80 active:bg-slate-100/80 transition-colors group"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Settings className="h-4 w-4 stroke-[2.2]" />
              </div>
              <span className="text-xs font-bold text-[#1a3860] group-hover:text-blue-600 transition-colors">
                Paramètres
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </Link>

          {/* 5. Aide & support */}
          <Link
            href="/profile/help"
            className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/80 active:bg-slate-100/80 transition-colors group"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <HelpCircle className="h-4 w-4 stroke-[2.2]" />
              </div>
              <span className="text-xs font-bold text-[#1a3860] group-hover:text-amber-700 transition-colors">
                Aide & support
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </Link>
        </div>

        {/* Accès Admin (si l'utilisateur est administrateur) */}
        {user?.role === "admin" && (
          <div className="mt-4 rounded-3xl glass-card bg-indigo-50/70 p-4 border border-indigo-100/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-950">Console Administrateur</p>
                <p className="text-[10px] text-indigo-600">Gestion des membres et statistiques</p>
              </div>
            </div>
            <a
              href="/admin"
              className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-xs hover:bg-indigo-700 transition-all flex items-center gap-1"
            >
              <span>Ouvrir</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* 4. BOUTON DÉCONNEXION (PILULE ROSE/ROUGE TRÈS SOIGNÉE) */}
        <div className="mt-5">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-3.5 rounded-full bg-rose-50/90 hover:bg-rose-100 text-rose-500 text-xs font-bold transition-all border border-rose-100 shadow-2xs active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4 stroke-[2.4]" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </div>

      {/* Barre de navigation inférieure */}
      <BottomNav userRole={user?.role ?? "user"} />
    </div>
  );
}
