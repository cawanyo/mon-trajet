"use client";

import React from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { ShieldAlert, Loader2 } from "lucide-react";

interface AdminLayoutGuardProps {
  children: React.ReactNode;
}

export const AdminLayoutGuard: React.FC<AdminLayoutGuardProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f4f7fb]">
        <Loader2 className="h-7 w-7 animate-spin text-[#175276]" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f7fb] p-6 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-rose-500" />
        <h2 className="text-base font-bold text-[#1a3860]">Accès réservé</h2>
        <p className="text-xs text-[#7d8fa5]">
          Cette section est strictement réservée aux administrateurs de l'application.
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 rounded-xl bg-[#175276] text-white text-xs font-bold hover:bg-[#134260] transition-all cursor-pointer"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
