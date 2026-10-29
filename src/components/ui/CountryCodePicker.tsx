"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { ALL_COUNTRIES } from "@/lib/countries";
import { Search, ChevronDown, Check } from "lucide-react";

interface CountryCodePickerProps {
  selectedCode: string;
  onSelect: (code: string) => void;
  className?: string;
}

export const CountryCodePicker: React.FC<CountryCodePickerProps> = ({
  selectedCode,
  onSelect,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentCountry = useMemo(() => {
    return (
      ALL_COUNTRIES.find((c) => c.code === selectedCode) || {
        name: "France",
        code: "+33",
        iso: "FR",
        flag: "🇫🇷",
      }
    );
  }, [selectedCode]);

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return ALL_COUNTRIES;
    const q = search.toLowerCase().trim();
    return ALL_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.includes(q) ||
        c.iso.toLowerCase().includes(q)
    );
  }, [search]);

  // Fermer le menu lors d'un clic en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      // Focus automatique sur le champ de recherche
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Fermer avec la touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className={`relative inline-block ${isOpen ? "z-50" : "z-auto"}`}>
      {/* Bouton déclencheur compact */}
      <button
        type="button"
        onClick={() => {
          setSearch("");
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-1.5 rounded-xl bg-slate-100/90 hover:bg-slate-200/90 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 transition-all active:scale-95 ${className}`}
        title="Changer d'indicatif"
      >
        <span className="text-sm leading-none">{currentCountry.flag}</span>
        <span className="font-mono text-xs">{currentCountry.code}</span>
        <ChevronDown
          className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Petite liste déroulante ancrée au premier plan directement sous le bouton */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 z-[9999] w-72 rounded-2xl bg-white dark:bg-slate-900 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.25)] border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150">
          {/* Mini champ de recherche */}
          <div className="relative mb-1.5">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher pays ou indicatif..."
              className="w-full rounded-xl bg-slate-100/80 dark:bg-slate-800/80 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1.5 focus:ring-sky-500"
            />
          </div>

          {/* Liste déroulante compacte avec scroll */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50 pr-0.5">
            {filteredCountries.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                Aucun résultat
              </div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected = c.code === selectedCode && c.name === currentCountry.name;
                return (
                  <button
                    type="button"
                    key={`${c.iso}-${c.code}-${c.name}`}
                    onClick={() => {
                      onSelect(c.code);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between py-2 px-2.5 rounded-lg text-left text-xs transition-colors ${
                      isSelected
                        ? "bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold"
                        : "hover:bg-slate-100/80 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-base leading-none">{c.flag}</span>
                      <span className="truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <span className="font-mono text-slate-400 text-[11px] font-semibold">
                        {c.code}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-sky-600" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
