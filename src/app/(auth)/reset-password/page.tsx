"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { MonTrajetLogo } from "@/components/ui/MonTrajetLogo";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft, Loader2, KeyRound, Mail } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlToken = searchParams.get("token") || "";

  const [token, setToken] = useState(urlToken);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Vérifier la validité du token s'il est présent dans l'URL
  const tokenCheck = useQuery(
    api.passwordReset.verifyResetToken,
    urlToken ? { token: urlToken } : "skip"
  );

  const completeReset = useMutation(api.passwordReset.completePasswordReset);

  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
    }
  }, [urlToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 6) {
      setErrorMessage("Le mot de passe doit comporter au moins 6 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Les deux mots de passe ne correspondent pas.");
      return;
    }

    if (!token && (!email.trim() || !code.trim())) {
      setErrorMessage("Veuillez renseigner votre email et le code de sécurité reçu.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await completeReset({
        token: token || undefined,
        code: code.trim() || undefined,
        email: email.trim().toLowerCase() || undefined,
        newPassword,
      });

      if (res && res.token) {
        // Enregistrer la nouvelle session immédiatement
        try {
          localStorage.setItem("mon_trajet_session_token", res.token);
          localStorage.setItem("has_seen_onboarding", "true");
        } catch (e) {}
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err: any) {
      setErrorMessage(
        err.message?.replace(/\[CONVEX[^\]]*\]\s*/gi, "") ||
          "Impossible de réinitialiser le mot de passe. Veuillez vérifier le code et réessayer."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Écran de succès
  if (isSuccess) {
    return (
      <div className="text-center space-y-4 animate-in fade-in duration-300">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mx-auto">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Mot de passe réinitialisé !</h2>
        <p className="text-xs text-slate-500 max-w-xs mx-auto">
          Votre nouveau mot de passe a bien été enregistré. Vous allez être redirigé vers l'application...
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl bg-[#175276] px-5 py-2.5 text-xs font-bold text-white shadow-xs"
          >
            Aller à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  // Si le token URL est invalide ou expiré
  if (urlToken && tokenCheck && !tokenCheck.valid) {
    return (
      <div className="text-center space-y-4 animate-in fade-in duration-300">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 mx-auto">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Lien expiré ou invalide</h2>
        <p className="text-xs text-slate-500 max-w-xs mx-auto">
          Ce lien de réinitialisation a déjà été utilisé ou sa durée de validité de 15 minutes est écoulée.
        </p>
        <div className="pt-2 flex flex-col gap-2">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl bg-[#175276] px-5 py-2.5 text-xs font-bold text-white shadow-xs"
          >
            Faire une nouvelle demande
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Alerte Erreur */}
      {errorMessage && (
        <div className="rounded-2xl bg-rose-50 p-3.5 border border-rose-200 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-rose-700 leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* Si pas de token URL : saisie Email + Code 6 chiffres */}
      {!urlToken && (
        <>
          <div className="group relative flex items-center gap-3 rounded-2xl p-3 px-4 bg-white/80 border border-slate-200 shadow-2xs">
            <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-[#175276]" />
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-semibold text-slate-500">
                Votre adresse email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jean@domaine.fr"
                className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="group relative flex items-center gap-3 rounded-2xl p-3 px-4 bg-white/80 border border-slate-200 shadow-2xs">
            <KeyRound className="h-5 w-5 text-slate-400 group-focus-within:text-[#175276]" />
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-semibold text-slate-500">
                Code de sécurité à 6 chiffres
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full bg-transparent text-base font-mono font-bold tracking-widest text-[#1a3860] placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>
        </>
      )}

      {/* Champ Nouveau mot de passe */}
      <div className="group relative flex items-center gap-3 rounded-2xl p-3 px-4 bg-white/80 border border-slate-200 shadow-2xs">
        <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-[#175276]" />
        <div className="flex-1 min-w-0">
          <label className="block text-[11px] font-semibold text-slate-500">
            Nouveau mot de passe
          </label>
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 6 caractères"
            className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="text-slate-400 hover:text-slate-600 focus:outline-none"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {/* Confirmation mot de passe */}
      <div className="group relative flex items-center gap-3 rounded-2xl p-3 px-4 bg-white/80 border border-slate-200 shadow-2xs">
        <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-[#175276]" />
        <div className="flex-1 min-w-0">
          <label className="block text-[11px] font-semibold text-slate-500">
            Confirmer le mot de passe
          </label>
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Répétez le mot de passe"
            className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Bouton de validation */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex items-center justify-center rounded-full bg-gradient-to-r from-sky-600 via-blue-600 to-sky-600 py-3.5 text-sm font-bold text-white shadow-md active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <span>Enregistrer mon nouveau mot de passe</span>
        )}
      </button>

      <div className="text-center pt-2">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Retour à la connexion</span>
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative min-h-dvh w-full flex flex-col justify-between overflow-hidden bg-gradient-to-b from-sky-100 via-sky-50 to-white px-6 select-none py-10">
      {/* Halos d'ambiance */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-blue-200/40 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm mx-auto flex-1 flex flex-col justify-center">
        {/* Logo */}
        <div className="mb-6">
          <MonTrajetLogo variant="dark" size="md" showText={true} />
        </div>

        {/* Titre */}
        <div className="text-left mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Nouveau mot de passe
          </h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Définissez votre nouveau mot de passe sécurisé.
          </p>
        </div>

        {/* Formulaire dans Suspense */}
        <Suspense
          fallback={
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#175276]" />
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
