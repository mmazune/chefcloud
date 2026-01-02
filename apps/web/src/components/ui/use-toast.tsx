import * as React from 'react';

// Minimal toast hook for compile safety

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (props: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((props: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...props, id }]);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg border p-4 shadow-lg ${
              t.variant === 'destructive'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-gray-200 bg-white text-gray-900'
            }`}
          >
            {t.title && <p className="font-medium">{t.title}</p>}
            {t.description && <p className="text-sm opacity-90">{t.description}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  
  // If not in provider, return a no-op implementation
  if (!context) {
    return {
      toast: (props: Omit<Toast, 'id'>) => {
        // Fallback: log to console in development
        if (process.env.NODE_ENV === 'development') {
          console.log('[Toast]', props.title, props.description);
        }
      },
      toasts: [] as Toast[],
      dismiss: (_id: string) => {},
    };
  }
  
  return context;
}

// Re-export for convenience
export { ToastContext };
