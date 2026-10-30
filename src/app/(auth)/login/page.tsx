"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { MonTrajetLogo } from "@/components/ui/MonTrajetLogo";
import { formatAuthError } from "@/lib/error-utils";
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, HelpCircle, X, CheckCircle2, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"email" | "password" | "general" | null>(null);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const handleOpenForgot = () => {
    setForgotEmail(email.trim());
    setForgotSent(false);
    setForgotError(null);
    setIsForgotModalOpen(true);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    const cleanForgotEmail = forgotEmail.trim();
    if (!cleanForgotEmail) {
      setForgotError("Veuillez renseigner votre adresse email.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanForgotEmail)) {
      setForgotError("Veuillez saisir une adresse email valide.");
      return;
    }

    setIsForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanForgotEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'envoi de l'email.");
      }

      setForgotSent(true);
    } catch (err: any) {
      setForgotError(
        err.message || "Impossible d'envoyer l'email de réinitialisation. Veuillez vérifier votre connexion."
      );
    } finally {
      setIsForgotLoading(false);
    }
  };

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
    <div
      className="relative min-h-dvh w-full flex flex-col justify-between overflow-hidden bg-gradient-to-b from-sky-100 via-sky-50 to-white px-6 select-none"
      style={{
        paddingTop: "max(1.25rem, env(safe-area-inset-top, 1.25rem))",
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))",
      }}
    >
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
              onClick={handleOpenForgot}
              className="text-xs font-semibold text-sky-700 hover:text-sky-800 hover:underline transition-colors cursor-pointer"
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

      {/* Modal interactif pour mot de passe oublié via SMTP */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {forgotSent ? (
              <div className="text-center space-y-4 py-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mx-auto">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Email envoyé !
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Un message contenant votre code de sécurité à 6 chiffres et votre lien de réinitialisation a été envoyé à <strong>{forgotEmail}</strong>.
                  </p>
                </div>

                <div className="pt-2 space-y-2">
                  <Link
                    href={`/reset-password?email=${encodeURIComponent(forgotEmail)}`}
                    onClick={() => setIsForgotModalOpen(false)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#175276] py-3 text-xs font-bold text-white shadow-xs hover:bg-[#134260] active:scale-95 transition-all"
                  >
                    <span>Saisir le code & nouveau mot de passe</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => setForgotSent(false)}
                    className="w-full text-xs font-semibold text-slate-500 hover:text-slate-700 py-1.5"
                  >
                    Renvoyer à une autre adresse
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      Mot de passe oublié
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Recevez un lien et un code par email
                    </p>
                  </div>
                </div>

                <form onSubmit={handleForgotSubmit} className="space-y-3.5 mt-4">
                  {forgotError && (
                    <div className="rounded-xl bg-rose-50 p-2.5 border border-rose-200 text-xs text-rose-700 font-semibold flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div className="rounded-2xl p-2.5 px-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Votre adresse email
                    </label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="nom@exemple.com"
                      className="w-full mt-0.5 bg-transparent text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Vous recevrez un code de sécurité à 6 chiffres valable pendant 15 minutes pour définir un nouveau mot de passe.
                  </p>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsForgotModalOpen(false)}
                      className="flex-1 py-2.5 rounded-2xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isForgotLoading}
                      className="flex-1 py-2.5 rounded-2xl bg-[#175276] text-white text-xs font-bold hover:bg-[#134260] active:scale-95 transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isForgotLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span>Envoyer l'email</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
