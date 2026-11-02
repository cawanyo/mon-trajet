"use client";

import React, { useState, useRef } from "react";
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown, MapPin } from "lucide-react";
import { AddressAutocompleteInput } from "@/components/ui/AddressAutocompleteInput";

export interface TripStopItem {
  id: string;
  address: string;
  lat: number;
  lng: number;
}

interface TripStopsManagerProps {
  stops: TripStopItem[];
  onAddStop: () => void;
  onRemoveStop: (id: string) => void;
  onUpdateStop: (id: string, address: string, coords?: { lat: number; lng: number }) => void;
  onReorderStops: (fromIndex: number, toIndex: number) => void;
  routeEstimations?: Array<{ cumulativeDurationMinutes: number; legDistanceMeters: number }>;
  maxStops?: number;
  dropdownPosition?: "top" | "bottom" | "auto";
  className?: string;
  accentColor?: "amber" | "teal";
}

export const TripStopsManager: React.FC<TripStopsManagerProps> = ({
  stops,
  onAddStop,
  onRemoveStop,
  onUpdateStop,
  onReorderStops,
  routeEstimations,
  maxStops = 5,
  dropdownPosition = "top",
  className = "",
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Pour le support tactile (mobile / tablette)
  const touchStartY = useRef<number>(0);
  const touchStartIndex = useRef<number | null>(null);
  const isDraggingTouch = useRef(false);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${index}`);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    // Si on quitte l'élément
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      onReorderStops(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Gestion des événements tactiles (Touch Drag)
  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartIndex.current = index;
    isDraggingTouch.current = true;
    setDraggedIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingTouch.current || touchStartIndex.current === null) return;
    const clientY = e.touches[0].clientY;
    const clientX = e.touches[0].clientX;
    const targetEl = document.elementFromPoint(clientX, clientY);
    const stopCard = targetEl?.closest("[data-stop-index]");
    if (stopCard) {
      const targetIndex = Number(stopCard.getAttribute("data-stop-index"));
      if (!isNaN(targetIndex) && targetIndex !== dragOverIndex) {
        setDragOverIndex(targetIndex);
      }
    }
  };

  const handleTouchEnd = () => {
    if (
      isDraggingTouch.current &&
      touchStartIndex.current !== null &&
      dragOverIndex !== null &&
      touchStartIndex.current !== dragOverIndex
    ) {
      onReorderStops(touchStartIndex.current, dragOverIndex);
    }
    isDraggingTouch.current = false;
    touchStartIndex.current = null;
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const moveUp = (index: number) => {
    if (index > 0) {
      onReorderStops(index, index - 1);
    }
  };

  const moveDown = (index: number) => {
    if (index < stops.length - 1) {
      onReorderStops(index, index + 1);
    }
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* En-tête de la section arrêts */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-[#1a3860]">
            Arrêts intermédiaires {stops.length > 0 && `(${stops.length})`}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Optionnel</span>
        </div>

        {stops.length < maxStops && (
          <button
            type="button"
            onClick={onAddStop}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100 transition-all cursor-pointer active:scale-95 shadow-2xs"
          >
            <Plus className="h-3 w-3 stroke-[2.5]" />
            <span>Ajouter un arrêt</span>
          </button>
        )}
      </div>

      {stops.length === 0 && (
        <p className="text-[11px] text-slate-500 italic">
          Aucun arrêt intermédiaire. Cliquez sur "Ajouter un arrêt" pour récupérer des passagers sur votre route.
        </p>
      )}

      {/* Liste des cartes d'arrêts ordonnées */}
      <div className="space-y-2" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {stops.map((stop, index) => {
          const est = routeEstimations?.[index];
          const isBeingDragged = draggedIndex === index;
          const isOver = dragOverIndex === index && draggedIndex !== index;

          return (
            <div
              key={stop.id}
              data-stop-index={index}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative rounded-2xl p-2.5 space-y-1.5 transition-all duration-150 border ${
                isBeingDragged
                  ? "opacity-50 border-amber-400 bg-amber-100/60 scale-[0.98] shadow-md ring-2 ring-amber-300"
                  : isOver
                  ? "border-amber-500 bg-amber-100/70 shadow-sm translate-y-0.5"
                  : "bg-amber-50/50 hover:bg-amber-50/80 border-amber-200/70 shadow-2xs"
              }`}
            >
              {/* Ligne d'en-tête de l'arrêt : Grip + Ordre + Flèches + Estimation + Poubelle */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {/* Poignée de glisser-déposer (Touch & Mouse) */}
                  <div
                    onTouchStart={(e) => handleTouchStart(e, index)}
                    className="p-1 -ml-1 text-slate-400 hover:text-amber-700 active:text-amber-800 cursor-grab active:cursor-grabbing select-none rounded touch-none flex items-center justify-center transition-colors"
                    title="Maintenir et glisser pour réordonner"
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>

                  {/* Numéro d'arrêt dynamique */}
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-black flex-shrink-0 shadow-xs">
                    {index + 1}
                  </span>

                  <span className="text-[11px] font-bold text-[#1a3860] whitespace-nowrap">
                    Arrêt {index + 1}
                  </span>

                  {est && (
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full whitespace-nowrap truncate max-w-[120px]">
                      ~{est.cumulativeDurationMinutes} min
                    </span>
                  )}
                </div>

                {/* Actions : Flèches haut/bas + Supprimer */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {/* Flèche Monter */}
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveUp(index)}
                    className="p-1 rounded text-slate-400 hover:text-[#1a3860] hover:bg-white disabled:opacity-20 disabled:hover:bg-transparent transition-all cursor-pointer"
                    title="Monter d'une position"
                  >
                    <ChevronUp className="h-3.5 w-3.5 stroke-[2.5]" />
                  </button>

                  {/* Flèche Descendre */}
                  <button
                    type="button"
                    disabled={index === stops.length - 1}
                    onClick={() => moveDown(index)}
                    className="p-1 rounded text-slate-400 hover:text-[#1a3860] hover:bg-white disabled:opacity-20 disabled:hover:bg-transparent transition-all cursor-pointer"
                    title="Descendre d'une position"
                  >
                    <ChevronDown className="h-3.5 w-3.5 stroke-[2.5]" />
                  </button>

                  {/* Bouton Supprimer */}
                  <button
                    type="button"
                    onClick={() => onRemoveStop(stop.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer ml-1"
                    title="Supprimer cet arrêt"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Champ d'adresse avec autocomplétion */}
              <AddressAutocompleteInput
                required
                value={stop.address}
                dropdownPosition={dropdownPosition}
                onChange={(addr, coords) => onUpdateStop(stop.id, addr, coords)}
                placeholder={`Adresse de l'arrêt ${index + 1}...`}
                icon={MapPin}
                iconColor="text-amber-600"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
