'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api';

interface ScanTrackerProps {
  shortCode: string;
}

export function ScanTracker({ shortCode }: ScanTrackerProps) {
  useEffect(() => {
    // Record scan on page load
    const referrer = typeof document !== 'undefined' ? document.referrer : undefined;
    api.recordScan(shortCode, referrer).catch(() => {
      // Silently fail - analytics should not block UX
    });
  }, [shortCode]);

  return null;
}
