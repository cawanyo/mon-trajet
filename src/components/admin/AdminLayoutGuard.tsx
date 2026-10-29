"use client";

import React from "react";
import { Monitor, AlertTriangle } from "lucide-react";

interface AdminLayoutGuardProps {
  children: React.ReactNode;
}

export const AdminLayoutGuard: React.FC<AdminLayoutGuardProps> = ({ children }) => {
  return (
    <>
      {/* 1. Affichage Mobile : Bloqué via CSS/Tailwind (md:hidden) */}
      <div className="flex md:hidden min-h-screen flex-col items-center justify-center p-6 text-center bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
            <Monitor className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Interface Réservée aux Ordinateurs
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
            Le tableau de bord Administrateur contient des tableaux d'analyse et des paramètres sensibles optimisés pour les grands écrans.
          </p>
          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>Veuillez vous connecter depuis un ordinateur de bureau ou un PC portable.</span>
          </div>
        </div>
      </div>

      {/* 2. Affichage Desktop (hidden sur mobile, affiché à partir de md:) */}
      <div className="hidden md:flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        {children}
      </div>
    </>
  );
};
