/**
 * Simple DatePicker component
 * Uses native HTML date input with styled wrapper
 */
'use client';

import * as React from 'react';
import { Input } from './input';

interface DatePickerProps {
    value?: Date | null;
    selected?: Date | null;
    onChange?: (date: Date | null) => void;
    onSelect?: (date: Date | null) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function DatePicker({
    value,
    selected,
    onChange,
    onSelect,
    placeholder = 'Select date',
    className,
    disabled,
}: DatePickerProps) {
    const dateValue = value ?? selected;
    const handleDateChange = onChange ?? onSelect;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        if (handleDateChange) {
            handleDateChange(inputValue ? new Date(inputValue) : null);
        }
    };

    const formatDate = (date: Date | null | undefined): string => {
        if (!date) return '';
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    };

    return (
        <Input
            type="date"
            value={formatDate(dateValue)}
            onChange={handleChange}
            placeholder={placeholder}
            className={className}
            disabled={disabled}
        />
    );
}

DatePicker.displayName = 'DatePicker';
