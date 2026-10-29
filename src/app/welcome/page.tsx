"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { MonTrajetLogo } from "@/components/ui/MonTrajetLogo";
import { ChevronRight, Heart } from "lucide-react";

interface Slide {
  title: string;
  subtitle: string;
  description: string;
}

const slides: Slide[] = [
  {
    title: "Mon Trajet",
    subtitle: "Covoiturage pour notre église",
    description: "Plus proches, plus solidaires, pour aller ensemble plus loin.",
  },
  {
    title: "Partagez\nvos trajets",
    subtitle: "Conducteurs fraternels",
    description: "Proposez vos places libres pour le culte et les rassemblements de l'église.",
  },
  {
    title: "Trouvez\nun covoiturage",
    subtitle: "Passagers de la paroisse",
    description: "Visualisez en temps réel les voitures disponibles autour de chez vous.",
  },
  {
    title: "100% Fraternel\n& Sécurisé",
    subtitle: "Communauté de confiance",
    description: "Chaque membre est vérifié par nos responsables avant de prendre la route.",
  },
];

export default function WelcomeOnboardingPage() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleStart = () => {
    try {
      localStorage.setItem("has_seen_onboarding", "true");
    } catch (e) {}
    router.push("/login");
  };

  const slide = slides[currentSlide];

  return (
    <div className="relative h-dvh w-full overflow-hidden select-none bg-slate-950">
      {/* 1. IMAGE D'ARRIÈRE-PLAN GÉO-RÉALISTE ET DÉGRADÉS */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-700 scale-105"
        style={{
          backgroundImage: `url('/images/onboarding-bg.jpg')`,
        }}
      />

      {/* Voile sombre et dégradé cinématique pour contraster le texte blanc */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-950/70 via-slate-950/40 to-slate-950/90 pointer-events-none" />

      {/* 2. CONTENU PRINCIPAL MOBILE SANS DÉCALAGE VERS LE BAS */}
      <div
        className="relative z-10 flex h-full flex-col justify-between px-6 max-w-sm mx-auto"
        style={{
          paddingTop: "max(1.25rem, env(safe-area-inset-top, 1.25rem))",
          paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))",
        }}
      >
        {/* En-tête : Nouveau Logo Mon Trajet & Textes */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-3">
            <MonTrajetLogo variant="light" size="lg" showText={false} />
          </div>

          {/* Titre principal */}
          <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-lg whitespace-pre-line leading-tight">
            {slide.title}
          </h1>

          {/* Sous-titre coloré */}
          <h2 className="mt-2 text-sm font-bold text-sky-200 drop-shadow">
            {slide.subtitle}
          </h2>

          {/* Phrase d'accroche */}
          <p className="mt-2 text-xs sm:text-sm text-slate-100/90 max-w-[260px] leading-relaxed drop-shadow font-medium">
            {slide.description}
          </p>
        </div>

        {/* Partie inférieure : Points de carrousel + Bouton Glassy + Footer */}
        <div className="flex flex-col items-center w-full space-y-6">
          {/* Indicateurs de progression (4 dots) */}
          <div className="flex items-center gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`transition-all duration-300 ${
                  currentSlide === idx
                    ? "w-6 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)]"
                    : "w-2 h-2 rounded-full bg-white/40 hover:bg-white/70"
                }`}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* BOUTON GLASSY "Commencer >" */}
          <button
            onClick={handleStart}
            className="group relative flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-500/40 via-sky-500/50 to-blue-600/40 px-8 text-base font-bold text-white shadow-[0_8px_32px_rgba(2,132,199,0.35)] backdrop-blur-2xl border border-white/50 active:scale-[0.98] transition-all hover:bg-gradient-to-r hover:from-blue-500/50 hover:via-sky-500/60 hover:to-blue-600/50"
          >
            <div className="absolute inset-x-4 top-1 h-[1px] bg-gradient-to-r from-transparent via-white/70 to-transparent rounded-full pointer-events-none" />
            <span className="tracking-wide">Commencer</span>
            <ChevronRight className="h-5 w-5 text-white/90 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Footer Fraternel */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-white/80 font-medium">
            <Heart className="h-3.5 w-3.5 text-rose-400 fill-rose-400/40" />
            <span>Une initiative de notre église</span>
          </div>
        </div>
      </div>
    </div>
  );
}
