"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { MonTrajetLogo } from "@/components/ui/MonTrajetLogo";
import { formatAuthError } from "@/lib/error-utils";
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, HelpCircle, X } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"email" | "password" | "general" | null>(null);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorField(null);

    // 1. Validation côté client
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Veuillez renseigner votre adresse email.");
      setErrorField("email");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError("Veuillez saisir une adresse email valide (ex: jean@domaine.com).");
      setErrorField("email");
      return;
    }

    if (!password) {
      setError("Veuillez saisir votre mot de passe.");
      setErrorField("password");
      return;
    }

    // 2. Appel à la mutation Convex
    setIsLoading(true);
    try {
      await login(cleanEmail, password);
    } catch (err: any) {
      const formatted = formatAuthError(err);
      setError(formatted);
      if (formatted.toLowerCase().includes("email") || formatted.toLowerCase().includes("identifiant")) {
        setErrorField("general");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden bg-gradient-to-b from-sky-100 via-sky-50 to-white px-6 py-8 select-none">
      {/* Halos lumineux d'ambiance pour l'effet Glassmorphism */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-blue-200/40 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 left-1/4 h-64 w-64 rounded-full bg-cyan-200/30 blur-3xl pointer-events-none" />

      {/* Contenu principal */}
      <div className="relative z-10 w-full max-w-sm mx-auto flex-1 flex flex-col justify-center">
        {/* Logo Mon Trajet */}
        <div className="mb-6">
          <MonTrajetLogo variant="dark" size="md" showText={true} />
        </div>

        {/* Titres */}
        <div className="text-left mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Se connecter
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Accédez à votre compte pour rejoindre la communauté.
          </p>
        </div>

        {/* Formulaire Glassy */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Alerte Erreur Élégante */}
          {error && (
            <div className="rounded-2xl bg-rose-50/90 dark:bg-rose-950/60 backdrop-blur-md p-3.5 border border-rose-200 dark:border-rose-900/60 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs font-semibold text-rose-700 dark:text-rose-300 leading-relaxed">
                {error}
              </div>
            </div>
          )}

          {/* Champ Email Glassy */}
          <div
            className={`group relative flex items-center gap-3.5 rounded-2xl p-3 px-4 backdrop-blur-2xl transition-all ${
              errorField === "email" || errorField === "general"
                ? "bg-rose-50/50 border border-rose-300 ring-2 ring-rose-200/50"
                : "bg-white/75 border border-white shadow-[0_4px_24px_rgba(2,132,199,0.06)] focus-within:shadow-[0_4px_28px_rgba(2,132,199,0.14)] focus-within:bg-white/95"
            }`}
          >
            <Mail
              className={`h-5 w-5 transition-colors flex-shrink-0 ${
                errorField === "email" || errorField === "general"
                  ? "text-rose-500"
                  : "text-slate-500 group-focus-within:text-sky-600"
              }`}
            />
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-semibold text-slate-500 leading-tight">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                  if (errorField) setErrorField(null);
                }}
                placeholder="exemple@domaine.com"
                className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Champ Mot de passe Glassy */}
          <div
            className={`group relative flex items-center gap-3.5 rounded-2xl p-3 px-4 backdrop-blur-2xl transition-all ${
              errorField === "password" || errorField === "general"
                ? "bg-rose-50/50 border border-rose-300 ring-2 ring-rose-200/50"
                : "bg-white/75 border border-white shadow-[0_4px_24px_rgba(2,132,199,0.06)] focus-within:shadow-[0_4px_28px_rgba(2,132,199,0.14)] focus-within:bg-white/95"
            }`}
          >
            <Lock
              className={`h-5 w-5 transition-colors flex-shrink-0 ${
                errorField === "password" || errorField === "general"
                  ? "text-rose-500"
                  : "text-slate-500 group-focus-within:text-sky-600"
              }`}
            />
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-semibold text-slate-500 leading-tight">
                Mot de passe
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                  if (errorField) setErrorField(null);
                }}
                placeholder="Votre mot de passe"
                className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-slate-400 hover:text-slate-600 focus:outline-none p-1"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Lien Mot de passe oublié */}
          <div className="text-right">
            <button
              type="button"
              onClick={() => setIsForgotModalOpen(true)}
              className="text-xs font-semibold text-sky-700 hover:text-sky-800 hover:underline transition-colors"
            >
              Mot de passe oublié ?
            </button>
          </div>

          {/* Bouton Primaire Glassy Dégradé Océan */}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-4 flex h-13 w-full items-center justify-center rounded-full bg-gradient-to-r from-sky-600 via-blue-600 to-sky-600 py-3.5 text-base font-bold text-white shadow-[0_10px_25px_-5px_rgba(2,132,199,0.5)] border border-white/30 backdrop-blur-md active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span>Se connecter</span>
            )}
          </button>
        </form>
      </div>

      {/* Footer avec lien vers inscription (SANS GOOGLE) */}
      <div className="relative z-10 text-center py-4">
        <p className="text-xs text-slate-500 font-medium">
          Pas encore de compte ?{" "}
          <Link
            href="/register"
            className="font-bold text-teal-600 hover:text-teal-700 underline underline-offset-2 transition-colors"
          >
            Créer un compte
          </Link>
        </p>
      </div>

      {/* Modal / Boîte d'aide pour mot de passe oublié */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300">
                <HelpCircle className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Réinitialisation
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Pour des raisons de sécurité fraternelle, veuillez contacter directement un responsable ou un pasteur de l'église afin qu'il puisse réinitialiser votre accès.
            </p>

            <button
              type="button"
              onClick={() => setIsForgotModalOpen(false)}
              className="w-full rounded-2xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
