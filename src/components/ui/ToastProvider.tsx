"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
  confirm: (options: string | ConfirmOptions) => Promise<boolean>;
  alert: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = "info") => {
      // Clean up string if error message has redundant prefixes
      const cleaned = message
        .replace(/^Error:\s*/i, "")
        .replace(/^[a-zA-Z]+Error:\s*/i, "")
        .trim();

      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev.slice(-1), { id, message: cleaned, type }]);

      setTimeout(() => {
        removeToast(id);
      }, 3500);
    },
    [removeToast]
  );

  const confirm = useCallback((options: string | ConfirmOptions): Promise<boolean> => {
    const opts: ConfirmOptions =
      typeof options === "string" ? { message: options } : options;

    return new Promise<boolean>((resolve) => {
      setConfirmState({
        isOpen: true,
        options: opts,
        resolve: (val: boolean) => {
          setConfirmState(null);
          resolve(val);
        },
      });
    });
  }, []);

  const alert = useCallback(
    (message: string, type: ToastType = "info") => {
      // If the message sounds like an error or validation, pick error type
      const isErrorLike =
        type === "error" ||
        /erreur|impossible|refus|invalide|obligatoire|veuillez|attention/i.test(
          message
        );
      addToast(message, isErrorLike ? "error" : type);
    },
    [addToast]
  );

  const toast = {
    success: (msg: string) => addToast(msg, "success"),
    error: (msg: string) => addToast(msg, "error"),
    info: (msg: string) => addToast(msg, "info"),
  };

  return (
    <ToastContext.Provider value={{ toast, confirm, alert }}>
      {children}

      {/* Floating Bottom Toasts (above mobile nav bar) */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-[999] w-[calc(100%-2rem)] max-w-sm pointer-events-none flex flex-col gap-2 items-center"
        style={{
          bottom: "max(5rem, calc(env(safe-area-inset-bottom, 0px) + 4.5rem))",
        }}
        aria-live="polite"
      >
        {toasts.map((t) => {
          const isSuccess = t.type === "success";
          const isError = t.type === "error";

          return (
            <div
              key={t.id}
              className="pointer-events-auto w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_10px_25px_rgba(15,23,42,0.12)] text-slate-800 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3"
            >
              <div className="flex-shrink-0">
                {isSuccess && (
                  <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  </div>
                )}
                {isError && (
                  <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 stroke-[2.5]" />
                  </div>
                )}
                {!isSuccess && !isError && (
                  <div className="w-7 h-7 rounded-full bg-sky-50 text-[#1a3860] flex items-center justify-center">
                    <Info className="w-4 h-4 stroke-[2.5]" />
                  </div>
                )}
              </div>

              <p className="flex-1 text-xs sm:text-sm font-medium leading-snug line-clamp-3">
                {t.message}
              </p>

              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                aria-label="Fermer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Bottom Confirm Dialog (docked cleanly at the bottom) */}
      {confirmState?.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center">
          {/* Subtle backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity"
            onClick={() => confirmState.resolve(false)}
          />

          {/* Action Sheet at bottom */}
          <div
            className="relative z-10 w-full max-w-sm px-4 pt-2 sm:p-5 pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-200"
            style={{
              paddingBottom: "max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))",
            }}
          >
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 space-y-4">
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto sm:hidden" />

              <div className="text-center space-y-1.5 pt-1">
                {confirmState.options.title && (
                  <h3 className="text-sm font-bold text-slate-900">
                    {confirmState.options.title}
                  </h3>
                )}
                <p className="text-sm text-slate-700 font-medium leading-snug">
                  {confirmState.options.message}
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => confirmState.resolve(false)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs sm:text-sm transition active:scale-[0.98]"
                >
                  {confirmState.options.cancelText || "Annuler"}
                </button>
                <button
                  type="button"
                  onClick={() => confirmState.resolve(true)}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-white font-medium text-xs sm:text-sm transition shadow-sm active:scale-[0.98] ${
                    confirmState.options.destructive
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-[#1a3860] hover:bg-[#152e4d]"
                  }`}
                >
                  {confirmState.options.confirmText || "Confirmer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
