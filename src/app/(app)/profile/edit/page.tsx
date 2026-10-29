"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { BottomNav } from "@/components/navigation/BottomNav";
import { AddressAutocompleteInput } from "@/components/ui/AddressAutocompleteInput";
import { useToast } from "@/components/ui/ToastProvider";
import {
  ChevronLeft,
  User,
  Mail,
  Phone,
  Lock,
  MapPin,
  Car,
  Check,
  Loader2,
  Camera,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";

// Compression d'image côté client pour galerie (optimise taille & fluidité)
function compressImage(file: File, maxWidth = 800, maxHeight = 800, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
}

export default function EditProfilePage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const updateUserProfile = useMutation(api.users.updateUserProfile);

  // Références d'input file pour ouvrir la galerie
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const vehicleInputRef = useRef<HTMLInputElement>(null);

  // États du formulaire
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  // Adresse de la maison avec autocomplétion
  const [homeAddress, setHomeAddress] = useState("");
  const [homeCoords, setHomeCoords] = useState<{ lat?: number; lng?: number }>({});

  // Véhicule : modèle + photo de galerie
  const [vehicleInfo, setVehicleInfo] = useState("");
  const [vehiclePhotoUrl, setVehiclePhotoUrl] = useState<string | undefined>(undefined);

  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);
  const [isProcessingVehicle, setIsProcessingVehicle] = useState(false);

  // Initialisation à partir des données de l'utilisateur
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhoneNumber(user.phoneNumber || "");
      setAvatarUrl(user.avatarUrl);
      setVehicleInfo((user as any).vehicleInfo || "");
      setVehiclePhotoUrl((user as any).vehiclePhotoUrl);

      const savedHome = (user as any).homeAddress;
      if (savedHome) {
        setHomeAddress(savedHome.address || "");
        setHomeCoords({ lat: savedHome.lat, lng: savedHome.lng });
      } else if ((user as any).city) {
        setHomeAddress((user as any).city);
      }
    }
  }, [user]);

  // Sélection photo de profil dans la galerie
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingAvatar(true);
    try {
      const compressedBase64 = await compressImage(file, 600, 600, 0.82);
      setAvatarUrl(compressedBase64);
    } catch (err) {
      toast.error("Erreur lors de la sélection de la photo.");
    } finally {
      setIsProcessingAvatar(false);
      if (e.target) e.target.value = "";
    }
  };

  // Sélection photo du véhicule dans la galerie
  const handleVehicleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingVehicle(true);
    try {
      const compressedBase64 = await compressImage(file, 900, 600, 0.82);
      setVehiclePhotoUrl(compressedBase64);
    } catch (err) {
      toast.error("Erreur lors de la sélection de la photo du véhicule.");
    } finally {
      setIsProcessingVehicle(false);
      if (e.target) e.target.value = "";
    }
  };

  // Enregistrement
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!name.trim()) {
      toast.error("Le nom est obligatoire.");
      return;
    }
    if (!phoneNumber.trim()) {
      toast.error("Le numéro de téléphone est obligatoire.");
      return;
    }

    setIsSaving(true);
    try {
      await updateUserProfile({
        token,
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
        avatarUrl,
        vehicleInfo: vehicleInfo.trim() || undefined,
        vehiclePhotoUrl,
        city: homeAddress.trim() || undefined,
        homeAddress: homeAddress.trim()
          ? {
              address: homeAddress.trim(),
              lat: homeCoords.lat,
              lng: homeCoords.lng,
            }
          : undefined,
      });

      toast.success("Profil mis à jour !");
      router.push("/profile");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative min-h-dvh bg-[#f4f7fb] text-slate-800 pb-24 select-none overflow-x-hidden">
      {/* Halos d'ambiance glassy subtils */}
      <div className="pointer-events-none fixed -top-20 -right-20 h-80 w-80 rounded-full bg-teal-200/20 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-1/3 -left-20 h-72 w-72 rounded-full bg-blue-100/30 blur-3xl z-0" />

      {/* 1. EN-TÊTE FIXE DU TEMPLATE : ← Mon profil */}
      <div
        className="sticky top-0 z-30 glass-panel bg-white/85 backdrop-blur-2xl border-b border-white/80 px-4 pb-3 shadow-2xs"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))" }}
      >
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            onClick={() => router.push("/profile")}
            className="flex h-9 w-9 items-center justify-center rounded-2xl glass-card bg-white/90 text-[#1a3860] hover:bg-white active:scale-95 transition-all shadow-2xs border border-white/90"
            title="Retour"
          >
            <ChevronLeft className="h-5 w-5 stroke-[2.4]" />
          </button>
          <h1 className="text-base font-bold text-[#1a3860]">
            Mon profil
          </h1>
        </div>
      </div>

      <div className="relative z-10 max-w-md mx-auto p-4 space-y-3.5">
        <form onSubmit={handleSave} className="space-y-3.5">
          {/* GROUPE 1 : IDENTITÉ & PHOTO DE PROFIL */}
          <div className="rounded-3xl glass-card bg-white p-4 border border-slate-100 shadow-xs space-y-3">
            {/* Photo de profil (sélection galerie) */}
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-full ring-2 ring-blue-100 shadow-xs overflow-hidden bg-slate-100">
                  {isProcessingAvatar ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#175276]" />
                  ) : avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-bold text-[#175276]">
                      {name ? name.charAt(0).toUpperCase() : "U"}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#175276] hover:bg-[#134665] text-white shadow-xs ring-2 ring-white active:scale-95 transition-all"
                  title="Choisir dans la galerie"
                >
                  <Camera className="h-3 w-3" />
                </button>
              </div>

              {/* Input file caché pour la galerie */}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                className="hidden"
              />

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="text-xs font-bold text-[#175276] hover:underline block text-left"
                >
                  Choisir une photo dans la galerie
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(undefined)}
                    className="text-[11px] text-rose-500 hover:underline block"
                  >
                    Supprimer la photo
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2 space-y-2.5 text-xs">
              {/* Nom complet */}
              <div className="space-y-1">
                <label className="font-bold text-[#1a3860]">Nom complet</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom et prénom"
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#175276] font-medium text-slate-800"
                />
              </div>

              {/* Email (Lecture seule - non modifiable) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[#1a3860]">Email</label>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    <Lock className="h-2.5 w-2.5" />
                    <span>Non modifiable</span>
                  </span>
                </div>
                <input
                  type="email"
                  disabled
                  value={user?.email || ""}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-100/90 text-slate-500 font-medium cursor-not-allowed select-none"
                />
              </div>
            </div>
          </div>

          {/* GROUPE 2 : COORDONNÉES & ADRESSE DE LA MAISON */}
          <div className="rounded-3xl glass-card bg-white p-4 border border-slate-100 shadow-xs space-y-2.5 text-xs">
            <h2 className="font-bold text-[#1a3860] text-xs">Coordonnées</h2>

            {/* Téléphone */}
            <div className="space-y-1">
              <label className="font-medium text-slate-700">Téléphone</label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="06 12 34 56 78"
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#175276] font-medium text-slate-800"
              />
            </div>

            {/* Adresse de la maison (Input autocomplete) */}
            <div className="space-y-1">
              <label className="font-medium text-slate-700 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-teal-600" />
                <span>Adresse de la maison</span>
              </label>
              <AddressAutocompleteInput
                value={homeAddress}
                onChange={(address, coords) => {
                  setHomeAddress(address);
                  if (coords) {
                    setHomeCoords(coords);
                  }
                }}
                placeholder="Votre adresse de résidence"
                inputClassName="py-2.5 px-3 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#138872]"
              />
            </div>
          </div>

          {/* GROUPE 3 : VÉHICULE & PHOTO DU VÉHICULE (GALERIE) */}
          <div className="rounded-3xl glass-card bg-white p-4 border border-slate-100 shadow-xs space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#1a3860] text-xs flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5 text-blue-600" />
                <span>Véhicule</span>
              </h2>
            </div>

            {/* Photo de la voiture (Galerie) */}
            <div className="space-y-1">
              <label className="font-medium text-slate-700">Photo de la voiture</label>

              <input
                ref={vehicleInputRef}
                type="file"
                accept="image/*"
                onChange={handleVehicleFileChange}
                className="hidden"
              />

              {vehiclePhotoUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-36 bg-slate-100 shadow-2xs group">
                  <img
                    src={vehiclePhotoUrl}
                    alt="Ma voiture"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => vehicleInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-white text-[#1a3860] text-[11px] font-bold shadow-sm"
                    >
                      Changer
                    </button>
                    <button
                      type="button"
                      onClick={() => setVehiclePhotoUrl(undefined)}
                      className="px-3 py-1.5 rounded-xl bg-rose-500 text-white text-[11px] font-bold shadow-sm"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => vehicleInputRef.current?.click()}
                  disabled={isProcessingVehicle}
                  className="w-full h-24 rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-300 bg-slate-50 hover:bg-blue-50/30 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-[#175276] transition-all"
                >
                  {isProcessingVehicle ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#175276]" />
                  ) : (
                    <>
                      <ImageIcon className="h-5 w-5 text-slate-400" />
                      <span className="text-[11px] font-bold">Choisir la photo dans la galerie</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Modèle & Marque */}
            <div className="space-y-1 pt-1">
              <label className="font-medium text-slate-700">Modèle & couleur</label>
              <input
                type="text"
                value={vehicleInfo}
                onChange={(e) => setVehicleInfo(e.target.value)}
                placeholder="Ex : Toyota Corolla • Blanc"
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#175276] font-medium text-slate-800"
              />
            </div>
          </div>

          {/* BOUTONS D'ACTION (COMPACTS & ÉLÉGANTS) */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="flex-1 py-3 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs active:scale-[0.98]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 rounded-full bg-gradient-to-r from-[#175276] via-[#1b7f80] to-[#249e83] hover:opacity-95 text-white text-xs font-bold transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <Check className="h-4 w-4 stroke-[2.5]" />
              )}
              <span>Enregistrer</span>
            </button>
          </div>
        </form>
      </div>

      {/* Barre de navigation inférieure */}
      <BottomNav userRole={user?.role ?? "user"} />
    </div>
  );
}
