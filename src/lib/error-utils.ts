/**
 * Nettoie et formate les erreurs serveur, réseau ou Convex en messages clairs,
 * bienveillants et purement humains pour l'utilisateur.
 *
 * Règle stricte : AUCUN texte technique (préfixes Convex, stack trace, noms de méthodes,
 * ArgumentValidationError, JSON brut, etc.) ne doit jamais être affiché à l'utilisateur.
 */
export function formatAuthError(error: unknown): string {
  if (!error) {
    return "Une erreur inattendue est survenue. Veuillez réessayer.";
  }

  let rawMessage = "";

  if (typeof error === "string") {
    rawMessage = error;
  } else if (error instanceof Error) {
    rawMessage = error.message;
  } else if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, unknown>;
    if (typeof errObj.data === "string") {
      rawMessage = errObj.data;
    } else if (typeof errObj.message === "string") {
      rawMessage = errObj.message;
    } else {
      rawMessage = JSON.stringify(error);
    }
  } else {
    rawMessage = String(error);
  }

  // Journalisation discrète pour le débogage développeur dans la console
  if (process.env.NODE_ENV !== "production") {
    console.debug("[AuthError raw]", rawMessage);
  }

  // 1. Extraction d'un message d'erreur interne Convex si présent
  // Ex: "[CONVEX M(auth:login)] Server Error: Identifiants incorrects."
  const serverErrorMatch = rawMessage.match(/(?:Server Error:\s*|Uncaught Error:\s*)([^\n]+)/i);
  let cleaned = serverErrorMatch && serverErrorMatch[1] ? serverErrorMatch[1].trim() : rawMessage;

  // Supprimer tout tag restant de style [CONVEX ...]
  cleaned = cleaned.replace(/\[CONVEX[^\]]*\]\s*/gi, "").trim();

  const lower = cleaned.toLowerCase();

  // 2. Détection par motif précis

  // Identifiants invalides (email ou mot de passe faux)
  if (
    lower.includes("identifiants incorrects") ||
    lower.includes("mot de passe incorrect") ||
    lower.includes("invalid password") ||
    lower.includes("invalid credentials") ||
    lower.includes("user not found") ||
    lower.includes("utilisateur introuvable")
  ) {
    return "Adresse email ou mot de passe incorrect. Veuillez vérifier votre saisie.";
  }

  // Compte en attente de validation
  if (
    lower.includes("pas été validé") ||
    lower.includes("en attente de validation") ||
    lower.includes("non validé") ||
    lower.includes("pending approval")
  ) {
    return "Votre compte n'a pas encore été activé. Un responsable de la paroisse doit le valider avant votre première connexion.";
  }

  // Compte refusé ou suspendu
  if (
    lower.includes("compte refusé") ||
    lower.includes("compte rejeté") ||
    lower.includes("suspendu") ||
    lower.includes("désactivé") ||
    lower.includes("rejected") ||
    lower.includes("banni")
  ) {
    return "L'accès à ce compte a été restreint. Veuillez contacter un responsable de l'église.";
  }

  // Compte déjà existant lors de l'inscription
  if (
    (lower.includes("déjà") || lower.includes("already exists")) &&
    (lower.includes("email") || lower.includes("compte") || lower.includes("utilisateur"))
  ) {
    return "Cette adresse email est déjà associée à un compte existant. Veuillez vous connecter.";
  }

  // Format d'email invalide
  if (
    lower.includes("format d'email") ||
    lower.includes("format d'adresse email") ||
    lower.includes("email invalide") ||
    lower.includes("invalid email")
  ) {
    return "Veuillez renseigner une adresse email valide (ex : jean@domaine.com).";
  }

  // Champs obligatoires manquants
  if (
    lower.includes("champs sont obligatoires") ||
    lower.includes("renseigner votre email") ||
    lower.includes("missing required")
  ) {
    return "Veuillez renseigner tous les champs obligatoires.";
  }

  // Longueur du mot de passe
  if (
    lower.includes("6 caractères") ||
    (lower.includes("mot de passe") && (lower.includes("court") || lower.includes("longueur")))
  ) {
    return "Le mot de passe doit comporter au moins 6 caractères.";
  }

  // Numéro de téléphone invalide
  if (lower.includes("téléphone") || lower.includes("phone")) {
    return "Veuillez saisir un numéro de téléphone portable valide.";
  }

  // Nom complet invalide
  if (lower.includes("nom complet") || lower.includes("prénom") || lower.includes("valid name")) {
    return "Veuillez renseigner votre nom et prénom.";
  }

  // Erreurs de connexion réseau / serveur injoignable / offline
  if (
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("connexion internet") ||
    lower.includes("websocket") ||
    lower.includes("offline") ||
    lower.includes("econnrefused") ||
    lower.includes("timeout") ||
    lower.includes("abort") ||
    lower.includes("load failed")
  ) {
    return "Connexion au serveur impossible. Veuillez vérifier votre connexion Internet.";
  }

  // Limitation de débit (Rate limit)
  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("trop de tentatives")
  ) {
    return "Trop de tentatives de connexion. Veuillez patienter un instant avant de réessayer.";
  }

  // Session expirée ou jeton invalide
  if (
    lower.includes("session expirée") ||
    lower.includes("non authentifié") ||
    lower.includes("token expiré") ||
    lower.includes("unauthorized")
  ) {
    return "Votre session a expiré. Veuillez vous reconnecter.";
  }

  // 3. Filet de sécurité absolu : AUCUN texte technique ne passe
  // Si le message n'est pas identifié ou ressemble à du code/erreur système,
  // renvoyer un message d'erreur bienveillant et sobre.
  return "Une erreur est survenue lors de la connexion. Veuillez vérifier votre saisie et réessayer.";
}
