"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter, usePathname } from "next/navigation";

interface User {
  _id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: "user" | "manager" | "admin";
  status: "pending" | "approved" | "rejected";
  avatarUrl?: string;
  bio?: string;
  vehicleInfo?: string;
  vehiclePhotoUrl?: string;
  city?: string;
  homeAddress?: {
    address: string;
    lat?: number;
    lng?: number;
  };
  preferences?: {
    pushNotifications?: boolean;
    smsNotifications?: boolean;
    locationSharing?: boolean;
    departureReminders?: boolean;
    hidePhoneUntilConfirmed?: boolean;
    preferredDetourRadius?: number;
  };
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phoneNumber: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "mon_trajet_session_token";
const ONBOARDING_KEY = "has_seen_onboarding";
const CACHED_USER_KEY = "mon_trajet_cached_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [cachedUser, setCachedUser] = useState<User | null>(null);
  const [isTokenLoaded, setIsTokenLoaded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Initialisation du token et de l'utilisateur en cache local pour affichage instantané
  useEffect(() => {
    try {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored) {
        setToken(stored);
      }
      const storedUser = localStorage.getItem(CACHED_USER_KEY);
      if (storedUser) {
        setCachedUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.warn("Storage non disponible:", e);
    } finally {
      setIsTokenLoaded(true);
    }
  }, []);

  // Récupération de l'utilisateur courant via Convex
  const user = useQuery(api.auth.me, token ? { token } : "skip");

  // Synchronisation du cache utilisateur dès que Convex répond
  useEffect(() => {
    if (user) {
      setCachedUser(user as User);
      try {
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
      } catch (e) {}
    }
  }, [user]);

  // Mutations d'authentification
  const loginMutation = useMutation(api.auth.login);
  const registerMutation = useMutation(api.auth.register);
  const logoutMutation = useMutation(api.auth.logout);

  // Redirection automatique pour les pages protégées et première visite
  useEffect(() => {
    if (!isTokenLoaded) return;

    const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/register");
    const isWelcomeRoute = pathname.startsWith("/welcome");

    if (!token) {
      // Première visite : Vérifier si l'utilisateur a déjà vu l'écran d'accueil d'onboarding
      let hasSeenOnboarding = false;
      try {
        hasSeenOnboarding = localStorage.getItem(ONBOARDING_KEY) === "true";
      } catch (e) {}

      if (!hasSeenOnboarding && !isWelcomeRoute) {
        router.push("/welcome");
      } else if (hasSeenOnboarding && !isAuthRoute && !isWelcomeRoute) {
        router.push("/login");
      }
    } else if (token && (isAuthRoute || isWelcomeRoute) && user) {
      router.push("/");
    }
  }, [token, isTokenLoaded, pathname, user, router]);

  // Déconnexion automatique si le token en session n'est plus valide sur le serveur
  useEffect(() => {
    if (isTokenLoaded && token && user === null) {
      setToken(null);
      setCachedUser(null);
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(CACHED_USER_KEY);
      } catch (e) {}
      router.push("/login");
    }
  }, [isTokenLoaded, token, user, router]);

  const login = async (email: string, password: string) => {
    const res = await loginMutation({ email, password });
    setToken(res.token);
    try {
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(ONBOARDING_KEY, "true");
    } catch (e) {}
    router.push("/");
  };

  const register = async (name: string, email: string, phoneNumber: string, password: string) => {
    const res = await registerMutation({ name, email, phoneNumber, password });
    setToken(res.token);
    try {
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(ONBOARDING_KEY, "true");
    } catch (e) {}
    router.push("/");
  };

  const logout = async () => {
    if (token) {
      try {
        await logoutMutation({ token });
      } catch (e) {}
    }
    setToken(null);
    setCachedUser(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(CACHED_USER_KEY);
    } catch (e) {}
    router.push("/login");
  };

  const effectiveUser = user !== undefined ? (user as User | null) : cachedUser;
  const isLoading = !isTokenLoaded || (token !== null && user === undefined && cachedUser === null);

  return (
    <AuthContext.Provider
      value={{
        token,
        user: effectiveUser,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider");
  }
  return context;
}
