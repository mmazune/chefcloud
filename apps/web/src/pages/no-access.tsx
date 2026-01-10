/**
 * No Access Page
 * 
 * Displayed when a user logs in but has no accessible routes.
 * This is a fallback for edge cases where role configuration is incomplete.
 */

import React from 'react';
import { NoAccessPage } from '@/components/NoAccessPage';
import { useAuth } from '@/contexts/AuthContext';

export default function NoAccessRoute() {
  const { user } = useAuth();
  
  return (
    <NoAccessPage
      reason="forbidden"
      route="/"
      role={user?.jobRole}
    />
  );
}
