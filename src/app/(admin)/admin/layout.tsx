import React from "react";
import { AdminLayoutGuard } from "@/components/admin/AdminLayoutGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminLayoutGuard>
      <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950">
        {/* Sidebar Desktop Admin */}
        <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between">
          <div>
            <div className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-indigo-600" />
              <span>Admin Console</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Écran réservé aux ordinateurs</p>

            <nav className="mt-8 space-y-1">
              <a
                href="/admin"
                className="flex items-center gap-3 rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white"
              >
                Vue Globale & Stats
              </a>
              <a
                href="/admin/users"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"
              >
                Gestion des Rôles
              </a>
            </nav>
          </div>

          <div className="text-xs text-slate-400">
            Mon Trajet - Église v1.0
          </div>
        </aside>

        {/* Contenu principal Desktop */}
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </AdminLayoutGuard>
  );
}
