"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { MonTrajetLogo } from "@/components/ui/MonTrajetLogo";
import {
  Mail,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
} from "lucide-react";

type Step = "email" | "code" | "new_password" | "success";

export default function ForgotPasswordPage() {
  const router = useRouter();

  // État du processus pas-à-pas
  const [step, setStep] = useState<Step>("email");

  // Champs du formulaire
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // États de chargement et d'erreurs
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Mutations Convex
  const verifyCodeMutation = useMutation(api.passwordReset.verifyResetCode);
  const completeResetMutation = useMutation(api.passwordReset.completePasswordReset);

  // 1. Étape 1 : Demande du code par email
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage("Veuillez renseigner votre adresse email.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage("Veuillez saisir une adresse email valide (ex : nom@domaine.com).");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Une erreur est survenue lors de l'envoi du code.");
      }

      // Si le compte a été trouvé et le code envoyé
      setStep("code");
      setInfoMessage(`Un code de sécurité à 6 chiffres a été envoyé à ${cleanEmail}.`);
    } catch (err: any) {
      setErrorMessage(
        err.message || "Impossible de vérifier cette adresse email. Veuillez réessayer."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Étape 2 : Vérification du code reçu
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanCode = code.trim();
    if (cleanCode.length !== 6) {
      setErrorMessage("Le code de sécurité doit comporter exactement 6 chiffres.");
      return;
    }

    setIsLoading(true);
    try {
      await verifyCodeMutation({
        email: email.trim().toLowerCase(),
        code: cleanCode,
      });

      // Le code est correct : l'input de code disparaît et les 2 inputs de mot de passe apparaissent
      setStep("new_password");
      setInfoMessage("Code vérifié avec succès. Définissez à présent votre nouveau mot de passe.");
    } catch (err: any) {
      const msg = err.message?.replace(/\[CONVEX[^\]]*\]\s*/gi, "") || "";
      if (msg.includes("expiré")) {
        setErrorMessage("Ce code a expiré. Veuillez cliquer sur 'Renvoyer un code'.");
      } else if (msg.includes("incorrect")) {
        setErrorMessage("Code de sécurité incorrect. Veuillez vérifier le code reçu par email.");
      } else {
        setErrorMessage(msg || "Code invalide. Veuillez vérifier votre saisie.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Étape 3 : Définition et validation du nouveau mot de passe
  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 6) {
      setErrorMessage("Le mot de passe doit comporter au moins 6 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Les deux mots de passe ne correspondent pas. Veuillez vérifier votre saisie.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await completeResetMutation({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        newPassword,
      });

      if (res && res.token) {
        try {
          localStorage.setItem("mon_trajet_session_token", res.token);
          localStorage.setItem("has_seen_onboarding", "true");
        } catch (e) {}
      }

      setStep("success");
    } catch (err: any) {
      const msg = err.message?.replace(/\[CONVEX[^\]]*\]\s*/gi, "");
      setErrorMessage(
        msg || "Une erreur est survenue lors de l'enregistrement de votre mot de passe."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Permet à l'utilisateur de modifier son email s'il s'est trompé
  const handleChangeEmail = () => {
    setStep("email");
    setCode("");
    setErrorMessage(null);
    setInfoMessage(null);
  };

  // Renvoyer le code
  const handleResendCode = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInfoMessage("Un nouveau code à 6 chiffres vous a été envoyé par email.");
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors du renvoi du code.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-dvh w-full flex flex-col justify-between overflow-hidden bg-gradient-to-b from-sky-100 via-sky-50 to-white px-6 select-none"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top, 1.5rem))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 1.5rem))",
      }}
    >
      {/* Halos lumineux d'ambiance */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-blue-200/40 blur-3xl pointer-events-none" />

      {/* Contenu centré */}
      <div className="relative z-10 w-full max-w-sm mx-auto flex-1 flex flex-col justify-center">
        {/* Logo */}
        <div className="mb-5">
          <MonTrajetLogo variant="dark" size="md" showText={true} />
        </div>

        {/* ÉCRAN DE SUCCÈS FINAL */}
        {step === "success" ? (
          <div className="rounded-3xl bg-white/90 backdrop-blur-2xl p-6 border border-white shadow-[0_8px_30px_rgba(2,132,199,0.08)] text-center space-y-4 animate-in fade-in duration-300">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mx-auto">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Mot de passe mis à jour !
              </h2>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed font-medium">
                Votre nouveau mot de passe a bien été enregistré. Votre session est active et sécurisée.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-sky-600 via-blue-600 to-sky-600 text-sm font-bold text-white shadow-md active:scale-95 transition-all cursor-pointer"
              >
                Accéder à l'application
              </button>
            </div>
          </div>
        ) : (
          /* FORMULAIRE ÉVOLUTIF SUR LA MÊME PAGE */
          <div className="space-y-4">
            {/* Titre & Description */}
            <div className="text-left mb-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {step === "new_password" ? "Nouveau mot de passe" : "Mot de passe oublié"}
              </h1>
              <p className="mt-1 text-xs text-slate-500 font-medium leading-relaxed">
                {step === "email" && "Saisissez votre email pour recevoir votre code de vérification."}
                {step === "code" && "Entrez le code à 6 chiffres reçu dans votre boîte mail."}
                {step === "new_password" && "Choisissez et confirmez votre nouveau mot de passe."}
              </p>
            </div>

            {/* Bannière d'erreur soignée */}
            {errorMessage && (
              <div className="rounded-2xl bg-rose-50/95 backdrop-blur-md p-3.5 border border-rose-200 shadow-2xs flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-rose-700 leading-relaxed">
                  {errorMessage}
                </p>
              </div>
            )}

            {/* Bannière informative (succès étape) */}
            {infoMessage && !errorMessage && (
              <div className="rounded-2xl bg-sky-50/95 backdrop-blur-md p-3 border border-sky-200/80 shadow-2xs flex items-start gap-2 animate-in fade-in duration-150">
                <CheckCircle2 className="h-4 w-4 text-sky-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-sky-800 leading-relaxed">
                  {infoMessage}
                </p>
              </div>
            )}

            {/* 1. INPUT EMAIL (Se verrouille aux étapes suivantes) */}
            <div
              className={`group relative flex items-center gap-3.5 rounded-2xl p-3 px-4 backdrop-blur-2xl transition-all ${
                step !== "email"
                  ? "bg-slate-100/80 border border-slate-200/80 text-slate-500"
                  : "bg-white/80 border border-white shadow-[0_4px_24px_rgba(2,132,199,0.06)] focus-within:shadow-[0_4px_28px_rgba(2,132,199,0.14)] focus-within:bg-white/95"
              }`}
            >
              <Mail
                className={`h-5 w-5 flex-shrink-0 ${
                  step !== "email" ? "text-emerald-600" : "text-slate-400 group-focus-within:text-[#175276]"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-slate-500">
                    Adresse email
                  </label>
                  {step !== "email" && (
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                      Vérifié
                    </span>
                  )}
                </div>
                <input
                  type="email"
                  required
                  disabled={step !== "email"}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="exemple@domaine.com"
                  className={`w-full bg-transparent text-sm font-medium focus:outline-none ${
                    step !== "email" ? "text-slate-600 cursor-not-allowed" : "text-slate-800 placeholder-slate-400"
                  }`}
                />
              </div>
              {step === "code" && (
                <button
                  type="button"
                  onClick={handleChangeEmail}
                  className="text-[11px] font-bold text-[#175276] hover:underline cursor-pointer flex-shrink-0"
                >
                  Modifier
                </button>
              )}
            </div>

            {/* ÉTAPE 1 : BOUTON RECEVOIR LE CODE */}
            {step === "email" && (
              <form onSubmit={handleRequestCode} className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex h-13 w-full items-center justify-center rounded-full bg-gradient-to-r from-sky-600 via-blue-600 to-sky-600 py-3.5 text-sm font-bold text-white shadow-md active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      <span>Recevoir le code</span>
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </button>
              </form>
            )}

            {/* ÉTAPE 2 : INPUT DU CODE (Apparaît dès que le mail est validé) */}
            {step === "code" && (
              <form onSubmit={handleVerifyCode} className="space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="group relative flex items-center gap-3.5 rounded-2xl p-3 px-4 bg-white/85 border border-white shadow-[0_4px_24px_rgba(2,132,199,0.06)] focus-within:shadow-[0_4px_28px_rgba(2,132,199,0.14)] focus-within:bg-white/95 backdrop-blur-2xl transition-all">
                  <KeyRound className="h-5 w-5 text-slate-400 group-focus-within:text-[#175276] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <label className="block text-[11px] font-semibold text-slate-500">
                      Code de sécurité à 6 chiffres
                    </label>
                    <input
                      type="text"
                      autoFocus
                      required
                      maxLength={6}
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.replace(/\D/g, ""));
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="123456"
                      className="w-full bg-transparent text-lg font-mono font-bold tracking-widest text-[#1a3860] placeholder-slate-300 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || code.length !== 6}
                  className="flex h-13 w-full items-center justify-center rounded-full bg-gradient-to-r from-sky-600 via-blue-600 to-sky-600 py-3.5 text-sm font-bold text-white shadow-md active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span>Valider le code</span>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Vous n'avez pas reçu l'email ? Renvoyer</span>
                  </button>
                </div>
              </form>
            )}

            {/* ÉTAPE 3 : L'INPUT DU CODE DISPARAÎT ET LES 2 INPUTS MOT DE PASSE APPARAISSENT */}
            {step === "new_password" && (
              <form onSubmit={handleCompleteReset} className="space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Champ Nouveau mot de passe */}
                <div className="group relative flex items-center gap-3.5 rounded-2xl p-3 px-4 bg-white/85 border border-white shadow-[0_4px_24px_rgba(2,132,199,0.06)] focus-within:shadow-[0_4px_28px_rgba(2,132,199,0.14)] focus-within:bg-white/95 backdrop-blur-2xl transition-all">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-[#175276] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <label className="block text-[11px] font-semibold text-slate-500">
                      Nouveau mot de passe
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      autoFocus
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Minimum 6 caractères"
                      className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600 focus:outline-none p-1"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Champ Confirmation du mot de passe */}
                <div className="group relative flex items-center gap-3.5 rounded-2xl p-3 px-4 bg-white/85 border border-white shadow-[0_4px_24px_rgba(2,132,199,0.06)] focus-within:shadow-[0_4px_28px_rgba(2,132,199,0.14)] focus-within:bg-white/95 backdrop-blur-2xl transition-all">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-[#175276] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <label className="block text-[11px] font-semibold text-slate-500">
                      Confirmer le mot de passe
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Répétez le mot de passe"
                      className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex h-13 w-full items-center justify-center rounded-full bg-gradient-to-r from-sky-600 via-blue-600 to-sky-600 py-3.5 text-sm font-bold text-white shadow-md active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span>Enregistrer mon nouveau mot de passe</span>
                  )}
                </button>
              </form>
            )}

            {/* Lien retour à la connexion */}
            <div className="text-center pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Retour à la connexion</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center py-2">
        <p className="text-[11px] text-slate-400 font-medium">
          Mon Trajet Église • Covoiturage Solidaire
        </p>
      </div>
    </div>
  );
}
