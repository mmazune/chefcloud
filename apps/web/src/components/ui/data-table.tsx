import React from 'react';
import { cn } from '@/lib/utils';

// Support both simple accessor and TanStack Table-like accessorKey/cell API
interface Column<T> {
  header: string;
  accessor?: keyof T | ((row: T) => React.ReactNode);
  accessorKey?: string;
  cell?: (props: { row: { original: T } }) => React.ReactNode;
  id?: string;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  className?: string;
  emptyMessage?: string;
  isLoading?: boolean;
}

// Helper to get nested property from object using dot notation
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  className,
  emptyMessage = 'No data available',
  isLoading = false,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          <span className="ml-2">Loading...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const getCellValue = (row: T, column: Column<T>): React.ReactNode => {
    // If cell renderer is provided, use it (TanStack Table-like API)
    if (column.cell) {
      return column.cell({ row: { original: row } });
    }
    // If accessor function is provided
    if (typeof column.accessor === 'function') {
      return column.accessor(row);
    }
    // If accessor key is provided
    if (column.accessor) {
      return row[column.accessor];
    }
    // If accessorKey is provided (supports dot notation for nested properties)
    if (column.accessorKey) {
      return getNestedValue(row, column.accessorKey);
    }
    return null;
  };

  return (
    <div className={cn('overflow-hidden rounded-lg border', className)}>
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.id || column.accessorKey || index}
                className={cn(
                  'px-4 py-3 text-left text-sm font-medium text-muted-foreground',
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-background">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-muted/50 transition-colors">
              {columns.map((column, colIndex) => (
                <td key={column.id || column.accessorKey || colIndex} className={cn('px-4 py-3 text-sm', column.className)}>
                  {getCellValue(row, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
