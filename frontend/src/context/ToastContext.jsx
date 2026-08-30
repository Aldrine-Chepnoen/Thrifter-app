import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const DURATION_MS = 5000;

const ICONS = {
  error: AlertCircle,
  success: CheckCircle,
  info: Info,
};

const STYLES = {
  error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300',
  success: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-300',
  info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300',
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // type: 'error' (default) | 'success' | 'info'
  const showToast = useCallback((message, type = 'error') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => dismissToast(id), DURATION_MS);
    return id;
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4 space-y-2 pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || ICONS.error;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-2.5 border rounded-xl px-4 py-3 shadow-lg animate-[toast-in_0.2s_ease-out] ${STYLES[t.type] || STYLES.error}`}
            >
              <Icon className="w-4.5 h-4.5 mt-0.5 shrink-0" />
              <p className="text-sm flex-1 break-words">{t.message}</p>
              <button
                onClick={() => dismissToast(t.id)}
                className="shrink-0 opacity-60 hover:opacity-100"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
