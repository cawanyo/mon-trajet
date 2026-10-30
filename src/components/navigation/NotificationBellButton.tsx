"use client";

import React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";

interface NotificationBellButtonProps {
  variant?: "glass-panel" | "glass-dark" | "flat";
  className?: string;
}

export const NotificationBellButton: React.FC<NotificationBellButtonProps> = ({
  variant = "glass-panel",
  className = "",
}) => {
  const { token } = useAuth();
  const unreadCount = useQuery(
    api.users.getUnreadNotificationsCount,
    token ? { token } : "skip"
  );

  const count = typeof unreadCount === "number" ? unreadCount : 0;

  const baseStyle =
    "relative flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-95 select-none";

  const variantStyles = {
    "glass-panel":
      "bg-white/90 backdrop-blur-md border border-slate-200/80 text-[#1a3860] hover:bg-white hover:text-blue-700 shadow-xs",
    "glass-dark":
      "bg-white/20 hover:bg-white/30 backdrop-blur-md text-white shadow-xs",
    flat:
      "bg-slate-100 hover:bg-slate-200 text-slate-700 active:bg-slate-300",
  };

  const ringStyle = variant === "glass-dark" ? "ring-slate-900/60" : "ring-white";

  return (
    <Link
      href="/notifications"
      prefetch={true}
      className={`${baseStyle} ${variantStyles[variant]} ${className}`}
      title={count > 0 ? `${count} notification(s) non lue(s)` : "Notifications"}
      aria-label={count > 0 ? `${count} notification(s) non lue(s)` : "Notifications"}
    >
      <Bell className="h-4.5 w-4.5 stroke-[2.2]" />

      {count > 0 && (
        <span
          className={`absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-black ring-2 ${ringStyle} shadow-xs animate-in zoom-in-50 duration-200`}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
};
