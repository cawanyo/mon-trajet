"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/navigation/BottomNav";
import {
  ChevronLeft,
  HelpCircle,
  ChevronDown,
  Phone,
  Mail,
  ShieldCheck,
  Send,
  MessageCircle,
  Heart,
  CheckCircle2,
} from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_LIST: FAQItem[] = [
  {
    question: "Comment fonctionne le covoiturage de l'église ?",
    answer:
      "Chaque membre peut proposer des places disponibles dans sa voiture ou publier un besoin de trajet pour se rendre aux cultes et réunions. Dès qu'une demande est acceptée, le contact téléphonique est débloqué pour vous coordonner.",
  },
  {
    question: "Le service est-il payant ?",
    answer:
      "Non, le covoiturage paroissial est entièrement gratuit. C'est une démarche d'entraide fraternelle, solidaire et bénévole au sein de notre communauté chrétienne.",
  },
  {
    question: "Comment contacter un conducteur ?",
    answer:
      "Pour protéger la vie privée de nos membres, le numéro de téléphone n'est visible qu'une fois la réservation validée. Vous pourrez alors l'appeler directement en un clic sur le bouton 'Contacter le conducteur'.",
  },
  {
    question: "Que faire en cas d'imprévu ou d'annulation ?",
    answer:
      "Rendez-vous sur 'Mes trajets' ou 'Mes demandes' et appuyez sur 'Annuler'. Cela libérera immédiatement la place dans le véhicule du conducteur pour un autre paroissien, et préviendra l'autre membre sans délai.",
  },
  {
    question: "Comment faire valider mon compte ?",
    answer:
      "L'équipe d'accueil ou le responsable de l'église vérifie les nouvelles inscriptions pour assurer la sécurité de tous. La validation se fait généralement sous 24h. Vous recevrez une notification dès que votre compte est approuvé.",
  },
  {
    question: "Puis-je modifier ma demande de trajet libre ?",
    answer:
      "Oui ! Allez dans 'Mes demandes', ouvrez la fiche de votre demande et cliquez sur 'Modifier'. Vous pouvez ajuster le lieu de prise en charge, la plage horaire, le nombre de passagers ou ajouter une note.",
  },
];

export default function ProfileHelpPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [supportMessage, setSupportMessage] = useState("");
  const [isSent, setIsSent] = useState(false);

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;
    setIsSent(true);
    setSupportMessage("");
    setTimeout(() => setIsSent(false), 5000);
  };

  return (
    <div className="relative min-h-screen bg-[#f4f7fb] text-slate-800 pb-24 select-none overflow-x-hidden">
      {/* Halos d'ambiance glassy subtils */}
      <div className="pointer-events-none fixed -top-20 -right-20 h-80 w-80 rounded-full bg-teal-200/20 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-1/3 -left-20 h-72 w-72 rounded-full bg-blue-100/30 blur-3xl z-0" />

      {/* 1. EN-TÊTE FIXE DU TEMPLATE : ← Aide & support */}
      <div className="sticky top-0 z-30 glass-panel bg-white/85 backdrop-blur-2xl border-b border-white/80 px-4 pt-4 pb-3 shadow-2xs">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            onClick={() => router.push("/profile")}
            className="flex h-9 w-9 items-center justify-center rounded-2xl glass-card bg-white/90 text-[#1a3860] hover:bg-white active:scale-95 transition-all shadow-2xs border border-white/90"
            title="Retour au profil"
          >
            <ChevronLeft className="h-5 w-5 stroke-[2.4]" />
          </button>
          <div>
            <h1 className="text-base font-bold text-[#1a3860]">
              Aide & support
            </h1>
            <p className="text-[10px] text-[#7d8fa5]">
              Foire aux questions & contact paroissial
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-md mx-auto p-4 space-y-4">
        {/* BANNIÈRE CONTACT PASTORAL RAPIDE */}
        <div className="rounded-3xl glass-card bg-gradient-to-br from-[#175276] via-[#154665] to-[#0f354c] p-5 text-white shadow-md space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
              <Heart className="h-5 w-5 text-teal-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Besoin d'un coup de main ?</h2>
              <p className="text-xs text-white/80">L'équipe covoiturage de l'église est là pour vous</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
            <a
              href="tel:0123456789"
              className="py-2.5 px-3 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md font-bold text-center flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-white/20"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>Appeler l'église</span>
            </a>
            <a
              href="mailto:contact@eglise.fr"
              className="py-2.5 px-3 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md font-bold text-center flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-white/20"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Nous écrire</span>
            </a>
          </div>
        </div>

        {/* QUESTIONS FRÉQUEMMENT POSÉES (ACCORDÉONS) */}
        <div className="rounded-3xl glass-card bg-white p-5 border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <HelpCircle className="h-4 w-4 text-[#175276]" />
            <h2 className="text-xs font-bold text-[#1a3860] uppercase tracking-wider">
              Questions fréquentes
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {FAQ_LIST.map((faq, index) => {
              const isOpen = openIndex === index;
              return (
                <div key={index} className="py-2.5 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => toggleAccordion(index)}
                    className="w-full flex items-center justify-between text-left gap-2 text-xs font-bold text-[#1a3860] hover:text-[#175276] transition-colors"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-[#175276]" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-2 text-xs text-[#7d8fa5] leading-relaxed animate-in fade-in duration-150">
                      {faq.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* FORMULAIRE D'ASSISTANCE RAPIDE */}
        <div className="rounded-3xl glass-card bg-white p-5 border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <MessageCircle className="h-4 w-4 text-teal-600" />
            <h2 className="text-xs font-bold text-[#1a3860] uppercase tracking-wider">
              Poser une question à l'équipe
            </h2>
          </div>

          {isSent ? (
            <div className="py-4 text-center space-y-1.5 animate-in fade-in duration-200">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="text-xs font-bold text-[#1a3860]">Message bien reçu !</p>
              <p className="text-[11px] text-[#7d8fa5]">
                Un responsable de l'accueil vous répondra dans les plus brefs délais.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="space-y-2.5 text-xs">
              <textarea
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                required
                rows={3}
                placeholder="Décrivez votre question, un problème technique ou une suggestion pour la communauté..."
                className="w-full py-2.5 px-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#175276] transition-all text-xs"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-full bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] hover:opacity-95 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98]"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Envoyer mon message</span>
              </button>
            </form>
          )}
        </div>

        {/* CHARTE DE BIENVEILLANCE & RASSURANCE */}
        <div className="rounded-2xl bg-[#eef8fd] border border-[#d6effd] p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-600 text-white flex-shrink-0 shadow-xs">
            <ShieldCheck className="h-4 w-4 stroke-[2.2]" />
          </div>
          <p className="text-[11px] font-medium text-[#175276] leading-relaxed">
            Le covoiturage repose sur la confiance fraternelle, le respect mutuel et la ponctualité de chacun.
          </p>
        </div>
      </div>

      {/* Barre de navigation inférieure */}
      <BottomNav userRole={user?.role ?? "user"} />
    </div>
  );
}
