"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MapPin, Loader2, X } from "lucide-react";

export interface AddressSuggestion {
  displayName: string;
  street: string;
  city: string;
  postcode?: string;
  country?: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (address: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  className?: string;
  inputClassName?: string;
  rightElement?: React.ReactNode;
  dropdownPosition?: "top" | "bottom" | "auto";
}

export const AddressAutocompleteInput: React.FC<AddressAutocompleteInputProps> = ({
  value,
  onChange,
  placeholder = "Entrez une adresse...",
  label,
  required = false,
  icon: Icon = MapPin,
  iconColor = "text-[#2d6cb5]",
  className = "",
  inputClassName = "",
  rightElement,
  dropdownPosition = "auto",
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Synchronisation avec la prop value externe
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Calcul de la position absolue dans document.body (évite toute superposition / stacking context)
  const updatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const showAbove =
      dropdownPosition === "top" ||
      (dropdownPosition === "auto" && spaceBelow < 220 && rect.top > 220);

    if (showAbove) {
      setDropdownStyle({
        position: "fixed",
        bottom: `${window.innerHeight - rect.top + 6}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        maxHeight: `${Math.min(240, rect.top - 16)}px`,
        zIndex: 99999,
      });
    } else {
      setDropdownStyle({
        position: "fixed",
        top: `${rect.bottom + 6}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        maxHeight: `${Math.min(240, spaceBelow - 16)}px`,
        zIndex: 99999,
      });
    }
  };

  // Mise à jour de la position lors du scroll ou redimensionnement
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, suggestions.length, dropdownPosition]);

  // Fermeture si clic à l'extérieur (support souris et tactile mobile)
  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const fetchSuggestions = async (search: string) => {
    if (!search || search.trim().length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Essai prioritaire avec l'API officielle française api-adresse.data.gouv.fr (instantanée et ultra précise)
      try {
        const gouvRes = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(search.trim())}&limit=5`
        );
        if (gouvRes.ok) {
          const gouvData = await gouvRes.json();
          const gFeatures = gouvData.features || [];
          if (gFeatures.length > 0) {
            const parsedGouv: AddressSuggestion[] = gFeatures.map((f: any) => ({
              displayName: f.properties?.label || "",
              street: f.properties?.name || f.properties?.label || "",
              city: f.properties?.city || "",
              postcode: f.properties?.postcode || "",
              country: "France",
              lat: f.geometry?.coordinates?.[1] || 0,
              lng: f.geometry?.coordinates?.[0] || 0,
            }));
            setSuggestions(parsedGouv);
            setIsOpen(parsedGouv.length > 0);
            updatePosition();
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        // Fallback Photon
      }

      // 2. Fallback avec l'API Photon OpenStreetMap
      const response = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(search.trim())}&limit=5&lang=fr`
      );
      if (!response.ok) {
        setSuggestions([]);
        return;
      }

      const data = await response.json();
      const features = data.features || [];

      const parsed: AddressSuggestion[] = features.map((feat: any) => {
        const p = feat.properties || {};
        const coords = feat.geometry?.coordinates || [0, 0];

        const street = p.name || p.street || "";
        const city = p.city || p.town || p.village || "";
        const postcode = p.postcode || "";
        const country = p.country || "";

        const secParts = [postcode, city, country].filter(Boolean);
        const sec = secParts.join(", ");
        const displayName = street && sec ? `${street}, ${sec}` : street || sec;

        return {
          displayName,
          street: street || displayName,
          city,
          postcode,
          country,
          lat: coords[1],
          lng: coords[0],
        };
      });

      setSuggestions(parsed);
      setIsOpen(parsed.length > 0);
      updatePosition();
    } catch (err) {
      console.log("Erreur de recherche d'adresse :", err);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 250);
  };

  const handleSelectSuggestion = (item: AddressSuggestion) => {
    setQuery(item.displayName);
    onChange(item.displayName, { lat: item.lat, lng: item.lng });
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    onChange("");
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <Icon className={`absolute left-3.5 h-4 w-4 ${iconColor} pointer-events-none flex-shrink-0 z-10`} />

        <input
          type="text"
          required={required}
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true);
              updatePosition();
            } else if (query.trim().length >= 2) {
              fetchSuggestions(query);
            }
          }}
          placeholder={placeholder}
          className={`w-full rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200/80 py-2.5 pl-10 pr-9 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2d6cb5]/30 focus:border-[#2d6cb5] focus:bg-white shadow-xs transition-all ${inputClassName}`}
        />

        <div className="absolute right-2.5 flex items-center gap-1.5 z-10">
          {rightElement}
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          {!isLoading && query && (
            <button
              type="button"
              onClick={handleClear}
              className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Menu déroulant de suggestions rendu dans document.body via Portal pour être TOUJOURS au premier plan */}
      {mounted &&
        isOpen &&
        suggestions.length > 0 &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="rounded-2xl bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-2xl overflow-hidden py-1 divide-y divide-slate-100/90 overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
          >
            {suggestions.map((item, idx) => (
              <button
                key={`${item.displayName}-${idx}`}
                type="button"
                onMouseDown={(e) => {
                  // Empêche la perte de focus prématurée de l'input avant le clic
                  e.preventDefault();
                }}
                onClick={() => handleSelectSuggestion(item)}
                className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-[#f0f6fc] active:bg-[#e4effa] flex items-start gap-2.5 transition-colors group cursor-pointer"
              >
                <MapPin className="h-4 w-4 text-slate-400 group-hover:text-[#2d6cb5] flex-shrink-0 mt-0.5 transition-colors" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 group-hover:text-[#2d6cb5] truncate">
                    {item.street}
                  </p>
                  {(item.city || item.postcode || item.country) && (
                    <p className="text-[11px] text-slate-400 truncate">
                      {[item.postcode, item.city, item.country].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};
