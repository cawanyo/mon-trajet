"use client";

import React from "react";
import { BadgeCheck, Clock, ShieldAlert } from "lucide-react";

interface VerifiedTickerProps {
  status?: "approved" | "pending" | "rejected" | string;
  showText?: boolean;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export const VerifiedTicker: React.FC<VerifiedTickerProps> = ({
  status = "pending",
  showText = false,
  size = "sm",
  className = "",
}) => {
  const isApproved = status === "approved";
  const isPending = status === "pending";

  const iconSizes = {
    xs: "h-3.5 w-3.5",
    sm: "h-4 w-4",
    md: "h-5 w-5",
  };

  // Compte Validé : Ticker Officiel Certifié Église
  if (isApproved) {
    if (showText) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200/80 shadow-sm dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 ${className}`}
          title="Compte vérifié et approuvé par les responsables de l'église"
        >
          <BadgeCheck className={`${iconSizes[size]} fill-emerald-600 text-white flex-shrink-0 drop-shadow-sm`} />
          <span>Membre vérifié</span>
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center align-middle ${className}`}
        title="Compte vérifié et approuvé par les responsables de l'église"
      >
        <BadgeCheck className={`${iconSizes[size]} fill-sky-600 text-white drop-shadow-sm transition-transform hover:scale-110 cursor-help`} />
      </span>
    );
  }

  // Compte en attente (Non encore validé)
  if (isPending && showText) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50 ${className}`}
        title="Profil en cours de vérification par les responsables"
      >
        <Clock className="h-3 w-3 text-amber-600 flex-shrink-0" />
        <span>Vérification en cours</span>
      </span>
    );
  }

  return null;
};
