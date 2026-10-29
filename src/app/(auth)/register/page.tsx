"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { MonTrajetLogo } from "@/components/ui/MonTrajetLogo";
import { CountryCodePicker } from "@/components/ui/CountryCodePicker";
import { formatAuthError } from "@/lib/error-utils";
import { Mail, Lock, User, Phone, Eye, EyeOff, Loader2, ShieldCheck, AlertCircle } from "lucide-react";

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+33");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"name" | "email" | "phone" | "password" | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorField(null);

    // 1. Validation côté client
    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      setError("Veuillez renseigner votre nom complet.");
      setErrorField("name");
      return;
    }

    const cleanEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError("Veuillez saisir une adresse email valide (ex: jean@domaine.com).");
      setErrorField("email");
      return;
    }

    const cleanRawPhone = phoneNumber.replace(/[\s\.\-\(\)]/g, "");
    if (!cleanRawPhone || cleanRawPhone.length < 6) {
      setError("Veuillez saisir un numéro de téléphone portable valide.");
      setErrorField("phone");
      return;
    }

    if (!password || password.length < 6) {
      setError("Le mot de passe doit comporter au moins 6 caractères.");
      setErrorField("password");
      return;
    }

    // 2. Formatage international du numéro
    let formattedPhone = cleanRawPhone;
    if (!cleanRawPhone.startsWith("+")) {
      const withoutLeadingZero = cleanRawPhone.startsWith("0") ? cleanRawPhone.slice(1) : cleanRawPhone;
      formattedPhone = `${countryCode}${withoutLeadingZero}`;
    }

    setIsLoading(true);
    try {
      await register(cleanName, cleanEmail, formattedPhone, password);
    } catch (err: any) {
      const formatted = formatAuthError(err);
      setError(formatted);
      if (formatted.toLowerCase().includes("email")) {
        setErrorField("email");
      } else if (formatted.toLowerCase().includes("mot de passe")) {
        setErrorField("password");
      } else if (formatted.toLowerCase().includes("téléphone")) {
        setErrorField("phone");
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
        <div className="mb-4">
          <MonTrajetLogo variant="dark" size="md" showText={true} />
        </div>

        {/* Titres */}
        <div className="text-left mb-5">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Créer un compte
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Rejoignez la communauté de notre église.
          </p>
        </div>

        {/* Formulaire Glassy */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Alerte Erreur Élégante */}
          {error && (
            <div className="rounded-2xl bg-rose-50/90 dark:bg-rose-950/60 backdrop-blur-md p-3 border border-rose-200 dark:border-rose-900/60 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs font-semibold text-rose-700 dark:text-rose-300 leading-relaxed">
                {error}
              </div>
            </div>
          )}

          {/* Champ Nom complet */}
          <div
            className={`group relative z-10 flex items-center gap-3.5 rounded-2xl p-2.5 px-4 backdrop-blur-2xl transition-all ${
              errorField === "name"
                ? "bg-rose-50/50 border border-rose-300 ring-2 ring-rose-200/50"
                : "bg-white/75 border border-white shadow-[0_4px_24px_rgba(2,132,199,0.06)] focus-within:shadow-[0_4px_28px_rgba(2,132,199,0.14)] focus-within:bg-white/95"
            }`}
          >
            <User
              className={`h-5 w-5 transition-colors flex-shrink-0 ${
                errorField === "name" ? "text-rose-500" : "text-slate-500 group-focus-within:text-sky-600"
              }`}
            />
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-semibold text-slate-500 leading-tight">
                Nom complet
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                  if (errorField === "name") setErrorField(null);
                }}
                placeholder="Jean Dupont"
                className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Champ Email */}
          <div
            className={`group relative z-10 flex items-center gap-3.5 rounded-2xl p-2.5 px-4 backdrop-blur-2xl transition-all ${
              errorField === "email"
                ? "bg-rose-50/50 border border-rose-300 ring-2 ring-rose-200/50"
                : "bg-white/75 border border-white shadow-[0_4px_24px_rgba(2,132,199,0.06)] focus-within:shadow-[0_4px_28px_rgba(2,132,199,0.14)] focus-within:bg-white/95"
            }`}
          >
            <Mail
              className={`h-5 w-5 transition-colors flex-shrink-0 ${
                errorField === "email" ? "text-rose-500" : "text-slate-500 group-focus-within:text-sky-600"
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
                  if (errorField === "email") setErrorField(null);
                }}
                placeholder="jean@eglise.fr"
                className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Champ Téléphone avec Sélecteur d'Identifiant (+33 par défaut) */}
          <div
            className={`group relative z-30 flex items-center gap-2 rounded-2xl p-2 px-3 backdrop-blur-2xl transition-all ${
              errorField === "phone"
                ? "bg-rose-50/50 border border-rose-300 ring-2 ring-rose-200/50"
                : "bg-white/75 border border-white shadow-[0_4px_24px_rgba(2,132,199,0.06)] focus-within:shadow-[0_4px_28px_rgba(2,132,199,0.14)] focus-within:bg-white/95"
            }`}
          >
            <Phone
              className={`h-5 w-5 transition-colors flex-shrink-0 ml-1 ${
                errorField === "phone" ? "text-rose-500" : "text-slate-500 group-focus-within:text-sky-600"
              }`}
            />

            {/* Sélecteur de tous les pays du monde */}
            <CountryCodePicker
              selectedCode={countryCode}
              onSelect={(code) => setCountryCode(code)}
            />

            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-semibold text-slate-500 leading-tight">
                Téléphone portable
              </label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  if (error) setError(null);
                  if (errorField === "phone") setErrorField(null);
                }}
                placeholder="6 12 34 56 78"
                className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Champ Mot de passe */}
          <div
            className={`group relative z-10 flex items-center gap-3.5 rounded-2xl p-2.5 px-4 backdrop-blur-2xl transition-all ${
              errorField === "password"
                ? "bg-rose-50/50 border border-rose-300 ring-2 ring-rose-200/50"
                : "bg-white/75 border border-white shadow-[0_4px_24px_rgba(2,132,199,0.06)] focus-within:shadow-[0_4px_28px_rgba(2,132,199,0.14)] focus-within:bg-white/95"
            }`}
          >
            <Lock
              className={`h-5 w-5 transition-colors flex-shrink-0 ${
                errorField === "password" ? "text-rose-500" : "text-slate-500 group-focus-within:text-sky-600"
              }`}
            />
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-semibold text-slate-500 leading-tight">
                Mot de passe
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                  if (errorField === "password") setErrorField(null);
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
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Note sur la validation fraternelle */}
          <div className="flex items-start gap-2 rounded-2xl bg-sky-500/10 backdrop-blur-md p-3 text-xs text-sky-800 border border-sky-200/50">
            <ShieldCheck className="h-4 w-4 text-sky-600 flex-shrink-0 mt-0.5" />
            <span>
              Votre compte sera activé par un responsable de l'église avant votre premier trajet.
            </span>
          </div>

          {/* Bouton Primaire Glassy Dégradé Océan */}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 flex h-13 w-full items-center justify-center rounded-full bg-gradient-to-r from-sky-600 via-blue-600 to-sky-600 py-3.5 text-base font-bold text-white shadow-[0_10px_25px_-5px_rgba(2,132,199,0.5)] border border-white/30 backdrop-blur-md active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span>Créer mon compte</span>
            )}
          </button>
        </form>
      </div>

      {/* Footer avec lien vers connexion */}
      <div className="relative z-10 text-center py-4">
        <p className="text-xs text-slate-500 font-medium">
          Déjà un compte ?{" "}
          <Link
            href="/login"
            className="font-bold text-teal-600 hover:text-teal-700 underline underline-offset-2 transition-colors"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
