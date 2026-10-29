/**
 * Utilitaires de formatage et parsing de dates pour les trajets et demandes
 */

export function getLocalDateString(dateInput: Date | number = new Date()): string {
  const d = typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatCompactDate(ts: number): string {
  const d = new Date(ts);
  const day = d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day.charAt(0).toUpperCase() + day.slice(1)} à ${time}`;
}

export function formatRelativeTime(timestamp: number, currentTime: number = Date.now()): string {
  const diffMs = Math.max(0, currentTime - timestamp);
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `il y a ${diffDays} j`;
}

/**
 * Retourne la date CIBLE pour laquelle le trajet est demandé (ex: "Dim. 1 nov.", "Aujourd'hui")
 */
export function formatDemandTargetDate(
  desiredDate?: string,
  createdAt?: number,
  note?: string,
  withPrefix: boolean = false
): string {
  // 1. Si une date explicite "YYYY-MM-DD" est présente
  if (desiredDate) {
    const parts = desiredDate.split("-").map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const target = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
      const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      const formatted = target.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1);

      if (diffDays === 0) return withPrefix ? "Pour aujourd'hui" : `Aujourd'hui`;
      if (diffDays === 1) return withPrefix ? "Pour demain" : `Demain`;
      return withPrefix ? `Pour le ${capitalized}` : capitalized;
    }
  }

  // 2. Si une date textuelle a été extraite de la note
  if (note) {
    const matchExplicit = note.match(/Date(?:\s*souhaitée)?\s*:\s*([^•\(\n\r]+)/i);
    if (matchExplicit && matchExplicit[1].trim()) {
      const label = matchExplicit[1].trim();
      return withPrefix && !label.toLowerCase().startsWith("pour") ? `Pour le ${label}` : label;
    }
  }

  // 3. Repli : jour de création
  if (createdAt) {
    const d = new Date(createdAt);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const formatted = d.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1);

    if (isToday) return withPrefix ? "Pour aujourd'hui" : "Aujourd'hui";
    return withPrefix ? `Pour le ${capitalized}` : capitalized;
  }

  return "Date à convenir";
}

/**
 * Extrait le créneau horaire souhaité (ex: "08h - 10h")
 */
export function parseDemandSlot(desiredTimeSlot?: string, note?: string): string | null {
  if (desiredTimeSlot && desiredTimeSlot.trim()) {
    return desiredTimeSlot.trim();
  }

  if (note) {
    const match = note.match(/Créneau\s*:\s*(\d+)h\s*-\s*(\d+)h/i);
    if (match) {
      return `${match[1]}h - ${match[2]}h`;
    }
  }

  return null;
}
