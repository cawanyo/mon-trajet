"use client";

import React, { useMemo } from "react";
import { X } from "lucide-react";

export interface GpsLocationPoint {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

interface GpsChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  origin: GpsLocationPoint;
  destination: GpsLocationPoint;
  waypoints?: GpsLocationPoint[];
  tripId?: string;
  onOpenInApp?: () => void;
}

export function getGoogleMapsUrl(
  origin: GpsLocationPoint,
  destination: GpsLocationPoint,
  waypoints: GpsLocationPoint[] = []
): string {
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
  if (waypoints.length > 0) {
    const wpStr = waypoints.map((w) => `${w.lat},${w.lng}`).join("|");
    url += `&waypoints=${encodeURIComponent(wpStr)}`;
  }
  return url;
}

export function getWazeUrl(target: GpsLocationPoint): string {
  return `https://waze.com/ul?ll=${target.lat},${target.lng}&navigate=yes`;
}

export function getAppleMapsUrl(
  origin: GpsLocationPoint,
  destination: GpsLocationPoint
): string {
  return `https://maps.apple.com/?saddr=${origin.lat},${origin.lng}&daddr=${destination.lat},${destination.lng}&dirflg=d`;
}

export const GpsChooserModal: React.FC<GpsChooserModalProps> = ({
  isOpen,
  onClose,
  origin,
  destination,
  waypoints = [],
}) => {
  // Détection de l'appareil pour n'afficher que les options disponibles
  const isApple = useMemo(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const platform = (navigator as any).userAgentData?.platform || navigator.platform || "";
    return (
      /iPhone|iPad|iPod|Macintosh|MacIntel/i.test(ua) ||
      /iPhone|iPad|iPod|Mac/i.test(platform)
    );
  }, []);

  if (!isOpen) return null;

  // URLs pour les applications GPS
  const googleMapsUrl = getGoogleMapsUrl(origin, destination, waypoints);
  const wazeTarget = waypoints.length > 0 ? waypoints[0] : destination;
  const wazeUrl = getWazeUrl(wazeTarget);
  const appleMapsUrl = getAppleMapsUrl(origin, destination);

  const handleLaunchGps = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs sm:max-w-sm rounded-[28px] glass-panel bg-white/95 backdrop-blur-2xl border border-white/90 p-4 shadow-2xl space-y-3 animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête minimaliste */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Ouvrir avec
          </span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-all active:scale-90"
            title="Fermer"
          >
            <X className="h-3.5 w-3.5 stroke-[2.5]" />
          </button>
        </div>

        {/* Logos des options disponibles sur l'appareil */}
        <div className="flex items-center justify-around gap-2 pt-1 pb-1">
          {/* 1. Google Maps (Disponible partout) */}
          <button
            onClick={() => handleLaunchGps(googleMapsUrl)}
            className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-slate-200/90 shadow-md group-hover:scale-105 group-hover:shadow-lg transition-all">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                  fill="#4285F4"
                />
                <circle cx="12" cy="9" r="3" fill="#EA4335" />
                <circle cx="12" cy="9" r="1.5" fill="#FBBC05" />
              </svg>
            </div>
            <span className="text-[11px] font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
              Maps
            </span>
          </button>

          {/* 2. Waze (Disponible sur smartphone) */}
          <button
            onClick={() => handleLaunchGps(wazeUrl)}
            className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#33ccff] shadow-md shadow-[#33ccff]/30 text-white group-hover:scale-105 group-hover:shadow-lg transition-all">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.4 13.5c-.3 0-.6.1-.8.2-.5-1.5-1.9-2.7-3.6-2.7-1 0-1.9.4-2.5 1.1-.6-.6-1.5-1-2.5-1-1.7 0-3.1 1.2-3.6 2.7-.2-.1-.5-.2-.8-.2-1.4 0-2.6 1.2-2.6 2.6 0 1.4 1.2 2.6 2.6 2.6h13.8c1.4 0 2.6-1.2 2.6-2.6 0-1.4-1.2-2.7-2.6-2.7zM8.5 16c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm7 0c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1z" />
              </svg>
            </div>
            <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#00a6d6] transition-colors">
              Waze
            </span>
          </button>

          {/* 3. Apple Plans (Uniquement visible si l'appareil est un iPhone / iPad / Mac) */}
          {isApple && (
            <button
              onClick={() => handleLaunchGps(appleMapsUrl)}
              className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-700 shadow-md shadow-slate-900/20 text-white group-hover:scale-105 group-hover:shadow-lg transition-all">
                <svg
                  className="h-7 w-7 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="3 11 22 2 13 21 11 13 3 11" fill="white" />
                </svg>
              </div>
              <span className="text-[11px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                Plans
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
