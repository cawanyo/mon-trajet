/**
 * Nettoie et formate les erreurs serveur ou Convex en messages clairs et bienveillants pour l'utilisateur.
 */
export function formatAuthError(error: unknown): string {
  if (!error) return "Une erreur inattendue est survenue.";

  let message = "";
  if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "object" && error !== null && "message" in error) {
    message = String((error as any).message);
  } else {
    message = String(error);
  }

  // Nettoyage des préfixes techniques internes de Convex
  // Ex: "[CONVEX M(auth:login)] Server Error: Identifiants incorrects." -> "Identifiants incorrects."
  const serverErrorMatch = message.match(/(?:Server Error:\s*|Uncaught Error:\s*)([^\n]+)/i);
  if (serverErrorMatch && serverErrorMatch[1]) {
    message = serverErrorMatch[1].trim();
  } else {
    message = message.replace(/\[CONVEX[^\]]*\]\s*/gi, "").trim();
  }

  const lower = message.toLowerCase();

  // Mapping des cas fréquents vers des explications claires
  if (lower.includes("identifiants incorrects") || lower.includes("mot de passe incorrect") || lower.includes("email ou mot de passe")) {
    return "Adresse email ou mot de passe incorrect. Veuillez vérifier vos identifiants.";
  }

  if (lower.includes("pas été validé") || lower.includes("compte refusé") || lower.includes("compte rejeté")) {
    return "Votre compte n'a pas été validé par les responsables de l'église. Veuillez contacter un responsable.";
  }

  if (lower.includes("déjà") && (lower.includes("email") || lower.includes("compte"))) {
    return "Un compte existe déjà avec cette adresse email. Veuillez vous connecter.";
  }

  if (lower.includes("format d'email") || lower.includes("email invalide")) {
    return "Veuillez renseigner une adresse email valide (ex: jean@domaine.com).";
  }

  if (lower.includes("6 caractères") || lower.includes("mot de passe")) {
    return "Le mot de passe doit comporter au moins 6 caractères.";
  }

  if (lower.includes("téléphone") || lower.includes("incomplet")) {
    return "Veuillez saisir un numéro de téléphone portable valide.";
  }

  if (lower.includes("fetch failed") || lower.includes("network") || lower.includes("failed to fetch")) {
    return "Impossible de joindre le serveur. Veuillez vérifier votre connexion Internet.";
  }

  return message;
}
