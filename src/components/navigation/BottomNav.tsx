"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Car, Heart, User, ShieldCheck } from "lucide-react";

interface BottomNavProps {
  userRole?: "user" | "manager" | "admin";
  unreadNotificationsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  userRole = "user",
}) => {
  const pathname = usePathname();

  const isHomeActive = pathname === "/";
  const isTripsActive = pathname === "/trips" || pathname.startsWith("/trips");
  const isNeedsActive = pathname === "/needs" || pathname.startsWith("/needs");
  const isProfileActive = pathname === "/profile";
  const isManagerActive = pathname === "/manager";

  const navItems = [
    {
      label: "Accueil",
      href: "/",
      icon: Home,
      isActive: isHomeActive,
    },
    {
      label: "Trajets",
      href: "/trips",
      icon: Car,
      isActive: isTripsActive,
    },
    {
      label: "Demandes",
      href: "/needs",
      icon: Heart,
      isActive: isNeedsActive,
    },
    ...(userRole === "manager" || userRole === "admin"
      ? [
          {
            label: "Validation",
            href: "/manager",
            icon: ShieldCheck,
            isActive: isManagerActive,
          },
        ]
      : []),
    {
      label: "Profil",
      href: "/profile",
      icon: User,
      isActive: isProfileActive,
    },
  ];

  return (
    <nav
      className="fixed left-4 right-4 max-w-md mx-auto z-40 rounded-[28px] sm:rounded-full glass-panel px-2 py-1 transition-all"
      style={{
        bottom: "max(0.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))",
      }}
    >
      <div className="flex h-14 items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`relative flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                item.isActive
                  ? "text-[#2960a5] font-bold scale-105"
                  : "text-[#8898aa] hover:text-[#2960a5]"
              }`}
            >
              <Icon
                className={`h-5 w-5 transition-transform ${
                  item.isActive ? "stroke-[2.5px] scale-110" : "stroke-[1.8px]"
                }`}
              />
              <span
                className={`text-[11px] mt-0.5 tracking-tight ${
                  item.isActive
                    ? "font-bold text-[#2960a5]"
                    : "font-medium text-[#8898aa]"
                }`}
              >
                {item.label}
              </span>
              {item.isActive && (
                <span className="absolute -bottom-0.5 h-1 w-5 rounded-full bg-[#2960a5]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
