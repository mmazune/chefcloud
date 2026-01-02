import * as React from 'react';

// Minimal AlertDialog components for compile safety
// These provide basic modal dialog functionality

interface AlertDialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue>({
  open: false,
  setOpen: () => {},
});

export interface AlertDialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AlertDialog({ children, open: controlledOpen, onOpenChange }: AlertDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
    <AlertDialogContext.Provider value={{ open, setOpen }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

export function AlertDialogTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const { setOpen } = React.useContext(AlertDialogContext);
  
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => setOpen(true),
    });
  }
  
  return (
    <button type="button" onClick={() => setOpen(true)}>
      {children}
    </button>
  );
}

export function AlertDialogContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { open, setOpen } = React.useContext(AlertDialogContext);
  
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className={`relative z-50 bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4 ${className}`}>
        {children}
      </div>
    </div>
  );
}

export function AlertDialogHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

export function AlertDialogFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex justify-end gap-2 mt-4 ${className}`}>{children}</div>;
}

export function AlertDialogTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-lg font-semibold ${className}`}>{children}</h2>;
}

export function AlertDialogDescription({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm text-gray-500 mt-2 ${className}`}>{children}</p>;
}

export function AlertDialogAction({ children, onClick, className = '', disabled = false }: { children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean }) {
  const { setOpen } = React.useContext(AlertDialogContext);
  
  return (
    <button
      type="button"
      disabled={disabled}
      className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      onClick={() => {
        onClick?.();
        setOpen(false);
      }}
    >
      {children}
    </button>
  );
}

export function AlertDialogCancel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { setOpen } = React.useContext(AlertDialogContext);
  
  return (
    <button
      type="button"
      className={`px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 ${className}`}
      onClick={() => setOpen(false)}
    >
      {children}
    </button>
  );
}
