"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminLayoutGuard } from "@/components/admin/AdminLayoutGuard";
import { MonTrajetLogo } from "@/components/ui/MonTrajetLogo";
import {
  LayoutDashboard,
  Users,
  ArrowLeft,
} from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/admin",
      label: "Vue d'ensemble",
      icon: LayoutDashboard,
      active: pathname === "/admin",
    },
    {
      href: "/admin/users",
      label: "Membres & Rôles",
      icon: Users,
      active: pathname.startsWith("/admin/users"),
    },
  ];

  return (
    <AdminLayoutGuard>
      <div className="min-h-dvh flex flex-col md:flex-row bg-[#f4f7fb] text-slate-800 select-none">
        {/* Halos d'ambiance glassy discrets */}
        <div className="pointer-events-none fixed -top-24 -right-24 h-96 w-96 rounded-full bg-teal-200/20 blur-3xl z-0" />
        <div className="pointer-events-none fixed top-1/2 -left-28 h-80 w-80 rounded-full bg-blue-100/30 blur-3xl z-0" />

        {/* Sidebar Desktop (md:flex) */}
        <aside className="hidden md:flex w-60 border-r border-slate-200/80 bg-white/80 backdrop-blur-2xl p-5 flex-col justify-between flex-shrink-0 relative z-20">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <MonTrajetLogo variant="dark" size="sm" showText={true} />
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Admin
              </span>
            </div>

            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                      item.active
                        ? "bg-[#175276] text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100/80 hover:text-[#1a3860]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-[#175276] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Retour à l'application</span>
            </Link>
          </div>
        </aside>

        {/* Header Mobile (md:hidden) */}
        <header
          className="md:hidden sticky top-0 z-30 glass-panel bg-white/85 backdrop-blur-2xl border-b border-white/80 px-4 pb-2.5 shadow-xs"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0.75rem))" }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 active:scale-95 transition-all"
                title="Retour à l'application"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <span className="text-sm font-black text-[#1a3860]">Console Admin</span>
            </div>

            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Admin
            </span>
          </div>

          {/* Onglets navigation mobile */}
          <div className="flex rounded-2xl bg-slate-100/90 p-1 border border-white/60">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    item.active
                      ? "bg-white text-[#1a3860] shadow-xs"
                      : "text-slate-500 hover:text-[#1a3860]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </header>

        {/* Contenu principal */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative z-10 max-w-5xl">
          {children}
        </main>
      </div>
    </AdminLayoutGuard>
  );
}
