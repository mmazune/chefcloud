/**
 * M26-EXT3: POS Tabs Sidebar Component
 * 
 * Displays a filterable, sortable list of open tabs with quick resume functionality.
 * Features:
 * - Search by tab name, table label, or order ID
 * - Visual indicators for tab age and guest count
 * - Quick actions: Resume, Rename, Detach (close without payment)
 * - Sorted by age (oldest first) for easy monitoring
 */

'use client';

import React, { useMemo, useState } from 'react';
import type { PosOrderTabInfo } from '@/types/pos';
import {
  buildTabDisplayName,
  calculateTabAgeMinutes,
  formatTabAge,
  sortTabsByAge,
  filterTabsBySearch,
} from '@/lib/posTabs';

export interface PosTabsSidebarProps {
  open: boolean;
  onClose: () => void;

  // All open tabs
  tabs: PosOrderTabInfo[];

  // Current active tab (if any)
  activeTabId?: string | null;

  // Actions
  onResumeTab: (tabId: string) => void;
  onRenameTab: (tabId: string) => void;
  onDetachTab: (tabId: string) => void;
}

export function PosTabsSidebar(props: PosTabsSidebarProps) {
  const { open, onClose, tabs, activeTabId, onResumeTab, onRenameTab, onDetachTab } = props;

  const [searchQuery, setSearchQuery] = useState('');

  // Apply search and sort
  const filteredTabs = useMemo(() => {
    const searched = filterTabsBySearch(tabs, searchQuery);
    return sortTabsByAge(searched);
  }, [tabs, searchQuery]);

  const handleResumeClick = (tabId: string) => {
    onResumeTab(tabId);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Open Tabs</h2>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {tabs.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Close sidebar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tabs..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Tab List */}
        <div className="flex-1 overflow-y-auto">
          {filteredTabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm text-gray-500">
                {searchQuery ? 'No tabs match your search' : 'No open tabs'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTabs.map((tab) => {
                const isActive = tab.orderId === activeTabId;
                const displayName = buildTabDisplayName(tab.tabName, tab.tableLabel);
                const ageMinutes = calculateTabAgeMinutes(tab.createdAt);
                const ageDisplay = formatTabAge(ageMinutes);

                return (
                  <div
                    key={tab.orderId}
                    className={`px-4 py-3 hover:bg-gray-50 transition-colors ${
                      isActive ? 'bg-blue-50' : ''
                    }`}
                  >
                    {/* Tab Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900 truncate">
                            {displayName}
                          </h3>
                          {isActive && (
                            <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {ageDisplay}
                          </span>
                          {tab.guestCount && (
                            <span className="flex items-center gap-1">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              {tab.guestCount}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            {tab.itemCount}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          ${tab.orderTotal.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResumeClick(tab.orderId)}
                        className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                        disabled={isActive}
                      >
                        {isActive ? 'Current' : 'Resume'}
                      </button>
                      <button
                        onClick={() => onRenameTab(tab.orderId)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        aria-label="Rename tab"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDetachTab(tab.orderId)}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
                        aria-label="Close tab without payment"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
