// Calcul de distance en mètres selon la formule de Haversine
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Formatage lisible de la distance (ex: 850 m ou 2,4 km)
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1).replace(".", ",") : Math.round(km)} km`;
}

// Géocodage inverse robuste : Coordonnées GPS -> Vraie adresse postale lisible
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // 1. Essai avec l'API officielle française api-adresse.data.gouv.fr (instantanée et ultra précise)
  try {
    const res = await fetch(`https://api-adresse.data.gouv.fr/reverse/?lon=${lng}&lat=${lat}`);
    if (res.ok) {
      const data = await res.json();
      const label = data.features?.[0]?.properties?.label;
      if (label && label.trim().length > 0) {
        return label.trim();
      }
    }
  } catch (e) {
    // Continuer vers le fallback
  }

  // 2. Repli avec Photon Komoot (OpenStreetMap)
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`);
    if (res.ok) {
      const data = await res.json();
      const f = data.features?.[0];
      if (f) {
        const p = f.properties || {};
        const street = p.street
          ? p.housenumber
            ? `${p.housenumber} ${p.street}`
            : p.street
          : p.name || "";
        const city = p.city || p.town || p.village || "";
        const postcode = p.postcode || "";
        const parts = [street, [postcode, city].filter(Boolean).join(" ")].filter(Boolean);
        const resolved = parts.join(", ");
        if (resolved && resolved.trim().length > 0) {
          return resolved.trim();
        }
      }
    }
  } catch (e) {
    // Continuer vers le fallback
  }

  // 3. Repli Nominatim OpenStreetMap
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          "Accept-Language": "fr",
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.display_name) {
        // Raccourcir le display_name pour garder les éléments clés (rue, ville, code postal)
        const parts = data.display_name.split(",").map((s: string) => s.trim());
        if (parts.length >= 3) {
          return `${parts[0]}, ${parts[1]} ${parts[2]}`;
        }
        return data.display_name;
      }
    }
  } catch (e) {
    // Fallback final
  }

  return `Point GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

// Calcul du meilleur parcours : Succession optimale des points d'escale (passagers)
// Minimise la distance globale : Départ -> Escale 1 -> Escale 2 -> ... -> Destination
export function getOptimalWaypointsOrder<T extends { pickupLocation: { lat: number; lng: number } }>(
  start: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  escales: T[]
): T[] {
  if (escales.length <= 1) return escales;

  // Si <= 6 escales, calcul exact par permutations (rapide et mathématiquement optimal)
  if (escales.length <= 6) {
    let bestOrder: T[] = escales;
    let minTotalDist = Infinity;

    const permute = (arr: T[], m: T[] = []) => {
      if (arr.length === 0) {
        let currentDist = getDistanceMeters(start.lat, start.lng, m[0].pickupLocation.lat, m[0].pickupLocation.lng);
        for (let i = 0; i < m.length - 1; i++) {
          currentDist += getDistanceMeters(
            m[i].pickupLocation.lat,
            m[i].pickupLocation.lng,
            m[i + 1].pickupLocation.lat,
            m[i + 1].pickupLocation.lng
          );
        }
        currentDist += getDistanceMeters(
          m[m.length - 1].pickupLocation.lat,
          m[m.length - 1].pickupLocation.lng,
          destination.lat,
          destination.lng
        );

        if (currentDist < minTotalDist) {
          minTotalDist = currentDist;
          bestOrder = m;
        }
      } else {
        for (let i = 0; i < arr.length; i++) {
          const curr = arr.slice();
          const next = curr.splice(i, 1);
          permute(curr.slice(), m.concat(next));
        }
      }
    };

    permute(escales);
    return bestOrder;
  }

  // Heuristique du plus proche voisin si > 6 escales
  const remaining = [...escales];
  const ordered: T[] = [];
  let currentPos = start;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = getDistanceMeters(
        currentPos.lat,
        currentPos.lng,
        remaining[i].pickupLocation.lat,
        remaining[i].pickupLocation.lng
      );
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const chosen = remaining.splice(bestIdx, 1)[0];
    ordered.push(chosen);
    currentPos = chosen.pickupLocation;
  }

  return ordered;
}
