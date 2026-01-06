/**
 * Collapsible UI component
 * 
 * Provides expandable/collapsible content sections.
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const CollapsibleContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}>({
  isOpen: false,
  setIsOpen: () => { },
});

interface CollapsibleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}

export function Collapsible({ open = false, onOpenChange, children, className }: CollapsibleProps) {
  const [isOpen, setIsOpen] = React.useState(open);

  React.useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  const handleSetOpen: React.Dispatch<React.SetStateAction<boolean>> = (value) => {
    const newValue = typeof value === 'function' ? value(isOpen) : value;
    setIsOpen(newValue);
    onOpenChange?.(newValue);
  };

  return (
    <CollapsibleContext.Provider value={{ isOpen, setIsOpen: handleSetOpen }}>
      <div className={cn('', className)} data-state={isOpen ? 'open' : 'closed'}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

interface CollapsibleTriggerProps {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}

export function CollapsibleTrigger({ children, className, asChild }: CollapsibleTriggerProps) {
  const { isOpen, setIsOpen } = React.useContext(CollapsibleContext);

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void; className?: string }>, {
      onClick: handleClick,
      className: cn(className, (children as React.ReactElement<{ className?: string }>).props.className),
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn('cursor-pointer', className)}
      data-state={isOpen ? 'open' : 'closed'}
    >
      {children}
    </button>
  );
}

interface CollapsibleContentProps {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}

export function CollapsibleContent({ children, className }: CollapsibleContentProps) {
  const { isOpen } = React.useContext(CollapsibleContext);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn('', className)}
      data-state={isOpen ? 'open' : 'closed'}
    >
      {children}
    </div>
  );
}
