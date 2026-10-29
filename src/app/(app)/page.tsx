"use client";

import React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { CarpoolMap } from "@/components/map/CarpoolMap";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";

export default function HomeMapPage() {
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Requêtes réactives Convex branchées au token
  const trips = useQuery(api.trips.listAvailableTrips, token ? { token } : "skip");
  const needs = useQuery(api.requests.listOpenNeeds, token ? { token } : "skip");
  const nextTrip = useQuery(api.trips.getNextUpcomingTrip, token ? { token } : "skip");
  const churchSettings = useQuery(api.settings.getChurchSettings);

  // Mutations
  const requestSeat = useMutation(api.requests.createRequest);
  const matchOpenNeed = useMutation(api.requests.matchOpenNeedToTrip);
  const startTripMutation = useMutation(api.trips.startTrip);
  const updateDriverLocationMutation = useMutation(api.trips.updateDriverLocation);
  const advanceTripEscaleMutation = useMutation(api.trips.advanceTripEscale);
  const completeTripMutation = useMutation(api.trips.completeTrip);

  if (isAuthLoading || (token && (trips === undefined || needs === undefined))) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm font-medium text-slate-400">Chargement de la carte de l'église...</p>
        </div>
      </div>
    );
  }

  const churchLocation = churchSettings ?? {
    lat: 48.8566,
    lng: 2.3522,
    address: "Église Centrale de la Grâce, 15 rue des Lilas, Paris",
  };

  const handleRequestSeat = async (tripId: string) => {
    if (!token) return;
    try {
      await requestSeat({
        token,
        tripId: tripId as any,
        pickupLocation: {
          lat: 48.8566,
          lng: 2.3522,
          address: "Prise en charge à convenir avec le conducteur",
        },
        seatsRequested: 1,
      });
      toast.success("Demande envoyée ! Vous recevrez une alerte dès acceptation.");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la demande");
    }
  };

  const handlePickUpNeed = async (needId: string) => {
    router.push(`/requests/${needId}`);
  };

  return (
    <main className="relative min-h-screen w-full">
      <CarpoolMap
        trips={(trips as any) ?? []}
        needs={(needs as any) ?? []}
        currentUserId={user?._id}
        churchLocation={churchLocation}
        nextTrip={nextTrip as any}
        onRequestSeat={handleRequestSeat}
        onPickUpNeed={handlePickUpNeed}
        onCreateTripClick={(coords) => {
          if (coords) {
            router.push(`/trips/create?lat=${coords.lat}&lng=${coords.lng}`);
          } else {
            router.push("/trips/create");
          }
        }}
        onSignalNeedClick={(coords) => {
          if (coords) {
            router.push(`/rides/search?lat=${coords.lat}&lng=${coords.lng}`);
          } else {
            router.push("/rides/search");
          }
        }}
        onStartTrip={async (tripId, coords, nextDestination) => {
          if (!token) return;
          try {
            await startTripMutation({
              token,
              tripId: tripId as any,
              currentLocation: coords,
              nextDestinationName: nextDestination,
            });
          } catch (err: any) {
            console.warn("Erreur startTrip :", err?.message);
          }
        }}
        onUpdateDriverLocation={async (tripId, coords, nextDestination) => {
          if (!token) return;
          try {
            await updateDriverLocationMutation({
              token,
              tripId: tripId as any,
              location: coords,
              nextDestinationName: nextDestination,
            });
          } catch (err: any) {
            console.warn("Erreur updateDriverLocation :", err?.message);
          }
        }}
        onAdvanceEscale={async (tripId, nextIndex, nextDestination) => {
          if (!token) return;
          try {
            await advanceTripEscaleMutation({
              token,
              tripId: tripId as any,
              nextIndex,
              nextDestinationName: nextDestination,
            });
          } catch (err: any) {
            console.warn("Erreur advanceTripEscale :", err?.message);
          }
        }}
        onCompleteTrip={async (tripId) => {
          if (!token) return;
          try {
            await completeTripMutation({
              token,
              tripId: tripId as any,
            });
          } catch (err: any) {
            console.warn("Erreur completeTrip :", err?.message);
          }
        }}
      />
      <BottomNav userRole={user?.role ?? "user"} />
    </main>
  );
}
