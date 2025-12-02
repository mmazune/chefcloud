// apps/web/src/hooks/useLastErrorRecord.ts
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  readLastErrorRecord,
  clearLastErrorRecord,
  type LastErrorRecord,
} from '@/components/common/AppErrorBoundary';

export function useLastErrorRecord() {
  const [lastError, setLastError] = useState<LastErrorRecord | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setLastError(readLastErrorRecord());
  }, []);

  const clear = useCallback(() => {
    clearLastErrorRecord();
    setLastError(null);
  }, []);

  return { lastError, clear };
}
