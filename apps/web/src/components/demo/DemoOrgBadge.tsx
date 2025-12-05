/**
 * M33-DEMO-S3: Demo Org Badge Component
 * 
 * Displays a distinctive badge when the user is logged into a demo organization.
 * Renders the org name with a "DEMO" pill to make it clear this is a demo environment.
 * 
 * Design:
 * - Yellow/amber theme for visibility
 * - Inline-flex layout
 * - Org name + "DEMO" pill
 * - Matches ChefCloud design system (dark mode optimized)
 */

import React from 'react';

export interface DemoOrgBadgeProps {
  orgName: string;
}

export const DemoOrgBadge: React.FC<DemoOrgBadgeProps> = ({ orgName }) => {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-yellow-500/60 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-yellow-300">
      <span>{orgName}</span>
      <span className="rounded-full bg-yellow-500/80 px-1.5 py-0.5 text-[10px] font-bold text-black">
        DEMO
      </span>
    </span>
  );
};
