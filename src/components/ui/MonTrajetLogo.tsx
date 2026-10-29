import React from "react";
import Image from "next/image";

interface MonTrajetLogoProps {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

export const MonTrajetLogo: React.FC<MonTrajetLogoProps> = ({
  variant = "dark",
  size = "md",
  showText = true,
  className = "",
}) => {
  const isLight = variant === "light";

  const pixelSizes = {
    sm: 48,
    md: 72,
    lg: 96,
    xl: 120,
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
    xl: "text-4xl",
  };

  const px = pixelSizes[size];

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Icône officielle Glossy Community Carpool */}
      <div
        className="relative flex items-center justify-center transition-transform duration-300 hover:scale-105 drop-shadow-[0_8px_20px_rgba(2,132,199,0.25)]"
        style={{ width: px, height: px }}
      >
        <Image
          src="/images/logo.png"
          alt="Mon Trajet Logo"
          width={px * 2}
          height={px * 2}
          className="w-full h-full object-contain drop-shadow-md"
          priority
        />
      </div>

      {/* Typographie "Mon Trajet" */}
      {showText && (
        <div
          className={`mt-2.5 font-black tracking-tight text-center leading-none ${textSizes[size]} ${
            isLight ? "text-white drop-shadow-md" : "text-slate-900"
          }`}
        >
          <span>Mon </span>
          <span className={isLight ? "text-sky-300" : "text-sky-600"}>Trajet</span>
        </div>
      )}
    </div>
  );
};
