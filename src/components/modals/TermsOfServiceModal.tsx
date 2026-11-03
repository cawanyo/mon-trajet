"use client";

import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import {
  ShieldAlert,
  AlertTriangle,
  HeartHandshake,
  CheckCircle2,
  Car,
  UserCheck,
  LogOut,
  Loader2,
} from "lucide-react";

export function TermsOfServiceModal() {
  const { user, token, logout } = useAuth();
  const acceptTermsMutation = useMutation(api.users.acceptTerms);

  const [hasAgreed, setHasAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // N'afficher le popup que si l'utilisateur est authentifié et n'a pas encore validé les CGU
  if (!token || !user) return null;
  if (user.termsAcceptedAt) return null;

  const handleAccept = async () => {
    if (!hasAgreed) return;
    setIsSubmitting(true);
    try {
      await acceptTermsMutation({ token });
    } catch (err) {
      console.error("Erreur validation des conditions :", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefuse = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.error("Erreur lors de la déconnexion :", err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
      className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* En-tête */}
        <div className="bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] text-white p-5 sm:p-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 shadow-inner flex-shrink-0">
              <ShieldAlert className="h-6 w-6 text-white stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-200">
                Engagement Communautaire
              </span>
              <h2 id="terms-title" className="text-lg sm:text-xl font-bold leading-tight">
                Conditions d'utilisation & Sécurité
              </h2>
            </div>
          </div>
          <p className="text-xs text-white/85 mt-2 leading-relaxed">
            Pour accéder à l'application Mon Trajet, vous devez lire et accepter les règles de
            responsabilité et de sécurité ci-dessous.
          </p>
        </div>

        {/* Corps du texte défilant */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-600 leading-relaxed">
          {/* Avertissement clé */}
          <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-3.5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] sm:text-xs text-amber-900 leading-normal">
              <strong className="font-bold text-amber-950 block mb-0.5">
                Avertissement important de non-responsabilité :
              </strong>
              L'église et les concepteurs de l'application <strong>ne sont pas responsables</strong> de la
              sécurité, des risques, ni des dangers liés aux déplacements. Chaque utilisateur participe sous
              sa propre responsabilité.
            </div>
          </div>

          {/* Section 1 : Mise en relation */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-xs sm:text-sm">
              <HeartHandshake className="h-4 w-4 text-[#1b7f80] flex-shrink-0" />
              <h3>1. Mise en relation bienveillante et solidaire</h3>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-600 pl-6">
              L'application <strong>Mon Trajet</strong> a pour seul but de faciliter l'entraide fraternelle en
              mettant en relation des conducteurs et des passagers pour se rendre aux cultes et aux activités
              de l'église. Il s'agit d'une démarche purement bénévole et communautaire.
            </p>
          </div>

          {/* Section 2 : Vigilance de chacun */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-xs sm:text-sm">
              <UserCheck className="h-4 w-4 text-[#249e83] flex-shrink-0" />
              <h3>2. Prudence et vigilance individuelle</h3>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-600 pl-6">
              Chaque membre (conducteur comme passager) est tenu de faire preuve d'attention, de bon sens et
              de vigilance. Vérifiez les informations de votre covoitureur, convenez de lieux de rendez-vous
              sûrs et adoptez un comportement respectueux tout au long du trajet.
            </p>
          </div>

          {/* Section 3 : Exonération de responsabilité */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-xs sm:text-sm">
              <ShieldAlert className="h-4 w-4 text-rose-600 flex-shrink-0" />
              <h3>3. Dégagement total de responsabilité</h3>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-600 pl-6">
              L'église, ses pasteurs, ses responsables ainsi que les administrateurs de l'application{" "}
              <strong>déclinent formellement toute responsabilité</strong> en cas d'accident de la route,
              dommage corporel ou matériel, vol, retard, litige, ou tout autre incident survenant pendant
              ou à l'occasion d'un trajet de covoiturage.
            </p>
          </div>

          {/* Section 4 : Engagements du conducteur et du passager */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-xs sm:text-sm">
              <Car className="h-4 w-4 text-[#175276] flex-shrink-0" />
              <h3>4. Engagements des usagers</h3>
            </div>
            <ul className="text-[11px] sm:text-xs text-slate-600 pl-6 space-y-1 list-disc">
              <li>
                <strong>Conducteurs :</strong> Vous certifiez être en possession d'un permis de conduire en
                règle et d'une assurance automobile valide couvrant vos passagers. Vous vous engagez à
                respecter scrupuleusement le code de la route.
              </li>
              <li>
                <strong>Passagers :</strong> Vous vous engagez à monter à bord d'un véhicule sous votre
                entière responsabilité, à attacher votre ceinture de sécurité et à respecter la propreté du
                véhicule.
              </li>
            </ul>
          </div>
        </div>

        {/* Pied de page et boutons d'action */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex-shrink-0 space-y-3">
          {/* Checkbox de consentement explicite */}
          <label className="flex items-start gap-2.5 cursor-pointer group select-none">
            <input
              type="checkbox"
              checked={hasAgreed}
              onChange={(e) => setHasAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded text-[#1b7f80] border-slate-300 focus:ring-[#1b7f80] cursor-pointer"
            />
            <span className="text-[11px] sm:text-xs text-slate-700 font-medium group-hover:text-slate-900 transition-colors">
              J'ai lu, compris et j'accepte pleinement ces conditions ainsi que l'exonération de
              responsabilité de l'église et de l'application.
            </span>
          </label>

          {/* Boutons Refuser (Déconnexion) et Accepter */}
          <div className="flex flex-col-reverse sm:flex-row items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleRefuse}
              disabled={isLoggingOut || isSubmitting}
              className="w-full sm:w-auto px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
              ) : (
                <LogOut className="h-3.5 w-3.5" />
              )}
              <span>Refuser et se déconnecter</span>
            </button>

            <button
              type="button"
              onClick={handleAccept}
              disabled={!hasAgreed || isSubmitting || isLoggingOut}
              className="w-full sm:flex-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] text-white text-xs font-bold shadow-lg shadow-emerald-700/20 hover:opacity-95 transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>Accepter et continuer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
