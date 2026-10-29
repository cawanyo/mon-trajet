"useStrictMode";
import React from "react";
import { Clock, ShieldCheck, HeartHandshake } from "lucide-react";

interface PendingApprovalProps {
  userName?: string;
  onRefresh?: () => void;
}

export const PendingApprovalScreen: React.FC<PendingApprovalProps> = ({
  userName = "Chers amis",
  onRefresh,
}) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-12 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl shadow-slate-200/50 dark:bg-slate-900 dark:shadow-none border border-slate-100 dark:border-slate-800">
        {/* Icône animée */}
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
          <Clock className="h-10 w-10 animate-pulse" />
          <div className="absolute -bottom-1 -right-1 rounded-full bg-emerald-500 p-1.5 text-white">
            <ShieldCheck className="h-4 w-4" />
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Validation de votre compte
        </h1>

        <p className="mt-3 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          Bonjour <span className="font-semibold text-slate-900 dark:text-white">{userName}</span>, votre inscription est bien enregistrée !
        </p>

        <div className="my-6 rounded-2xl bg-slate-50 p-4 text-left text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 border border-slate-100 dark:border-slate-700/50">
          <div className="flex items-start gap-3">
            <HeartHandshake className="h-5 w-5 flex-shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
            <p>
              Pour assurer la sécurité et la convivialité de notre communauté d'église, chaque nouveau compte est vérifié par un responsable avant de pouvoir proposer ou réserver des trajets.
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
          Vous recevrez une notification dès que votre profil sera approuvé.
        </p>

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="w-full rounded-2xl bg-slate-900 py-4 text-base font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-md"
          >
            Vérifier le statut
          </button>
        )}
      </div>
    </div>
  );
};
