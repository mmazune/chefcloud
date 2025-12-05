import React from 'react';

export const SkipToContentLink: React.FC = () => {
  return (
    <a
      href="#main-content"
      className="
        sr-only
        focus:not-sr-only
        focus:fixed
        focus:top-2
        focus:left-2
        focus:z-50
        focus:rounded-md
        focus:bg-slate-900
        focus:px-3
        focus:py-2
        focus:text-xs
        focus:text-slate-50
        focus:outline-none
        focus:ring-2
        focus:ring-emerald-500
      "
    >
      Skip to main content
    </a>
  );
};
