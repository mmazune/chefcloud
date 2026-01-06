/**
 * Simple Sheet component (slide-out panel)
 * Provides shadcn/ui-compatible API using a simple overlay
 */
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SheetContextValue {
    open: boolean;
    setOpen: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue>({
    open: false,
    setOpen: () => { },
});

interface SheetProps {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function Sheet({ children, open: controlledOpen, onOpenChange }: SheetProps) {
    const [internalOpen, setInternalOpen] = React.useState(false);

    const open = controlledOpen ?? internalOpen;
    const setOpen = onOpenChange ?? setInternalOpen;

    return (
        <SheetContext.Provider value={{ open, setOpen }}>
            {children}
        </SheetContext.Provider>
    );
}

export function SheetTrigger({ children, asChild, className }: { children: React.ReactNode; asChild?: boolean; className?: string }) {
    const { setOpen } = React.useContext(SheetContext);

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<any>, {
            onClick: () => setOpen(true),
        });
    }

    return (
        <button type="button" className={className} onClick={() => setOpen(true)}>
            {children}
        </button>
    );
}

export function SheetContent({ children, className, side = 'right' }: { children: React.ReactNode; className?: string; side?: 'left' | 'right' | 'top' | 'bottom' }) {
    const { open, setOpen } = React.useContext(SheetContext);

    if (!open) return null;

    const sideClasses = {
        left: 'left-0 top-0 h-full w-[400px] border-r',
        right: 'right-0 top-0 h-full w-[400px] border-l',
        top: 'top-0 left-0 w-full h-[300px] border-b',
        bottom: 'bottom-0 left-0 w-full h-[300px] border-t',
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-black/50"
                onClick={() => setOpen(false)}
            />
            {/* Sheet panel */}
            <div
                className={cn(
                    'fixed z-50 bg-white shadow-lg p-6 overflow-auto',
                    sideClasses[side],
                    className
                )}
            >
                {/* Close button */}
                <button
                    type="button"
                    className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
                    onClick={() => setOpen(false)}
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                {children}
            </div>
        </>
    );
}

export function SheetHeader({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('mb-4', className)}>
            {children}
        </div>
    );
}

export function SheetTitle({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <h2 className={cn('text-lg font-semibold', className)}>
            {children}
        </h2>
    );
}

export function SheetDescription({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <p className={cn('text-sm text-gray-500', className)}>
            {children}
        </p>
    );
}

Sheet.displayName = 'Sheet';
SheetTrigger.displayName = 'SheetTrigger';
SheetContent.displayName = 'SheetContent';
SheetHeader.displayName = 'SheetHeader';
SheetTitle.displayName = 'SheetTitle';
SheetDescription.displayName = 'SheetDescription';
