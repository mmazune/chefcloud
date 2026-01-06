import * as React from 'react';

// Minimal Select components for compile safety
// Provides shadcn/ui-compatible API using native select

interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = React.createContext<SelectContextValue>({
  value: '',
  onValueChange: () => { },
  open: false,
  setOpen: () => { },
});

export interface SelectProps {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function Select({ children, value: controlledValue, defaultValue = '', onValueChange }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);

  const value = controlledValue ?? internalValue;
  const handleValueChange = onValueChange ?? setInternalValue;

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, open, setOpen }}>
      <div className="relative inline-block w-full">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { setOpen, open } = React.useContext(SelectContext);

  return (
    <button
      type="button"
      className={`flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      onClick={() => setOpen(!open)}
      aria-expanded={open}
    >
      {children}
      <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

export function SelectValue({ placeholder = '' }: { placeholder?: string }) {
  const { value } = React.useContext(SelectContext);
  return <span className={value ? '' : 'text-gray-500'}>{value || placeholder}</span>;
}

export function SelectContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { open, setOpen } = React.useContext(SelectContext);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={`absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}

export function SelectItem({ children, value, className = '' }: { children: React.ReactNode; value: string; className?: string }) {
  const { value: selectedValue, onValueChange, setOpen } = React.useContext(SelectContext);
  const isSelected = selectedValue === value;

  return (
    <div
      className={`relative flex cursor-pointer select-none items-center px-3 py-2 hover:bg-gray-100 ${isSelected ? 'bg-gray-100' : ''} ${className}`}
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
    >
      {children}
      {isSelected && (
        <svg className="absolute right-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );
}

export function SelectGroup({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function SelectLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-3 py-1.5 text-xs font-medium text-gray-500 ${className}`}>{children}</div>;
}

export function SelectSeparator({ className = '' }: { className?: string }) {
  return <div className={`my-1 h-px bg-gray-200 ${className}`} />;
}

// Convenience alias for SelectItem
Select.Option = SelectItem;
