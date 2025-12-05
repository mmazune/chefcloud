/**
 * M34-FE-PARITY-S2 (G3): Reports & Digests Master Hub
 * 
 * Curated landing page listing all key reports with descriptions and deep links.
 * Makes ChefCloud's reporting capabilities discoverable from a single entry point.
 */

import React from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  DollarSign,
  Package,
  Users,
  MessageSquare,
  FileText,
  Code,
  Calendar,
  TrendingUp,
} from 'lucide-react';

interface ReportDef {
  id: string;
  name: string;
  description: string;
  href: string;
  category: 'Sales' | 'Finance' | 'Operations' | 'HR' | 'Customer' | 'Tech' | 'Admin';
  icon: React.ReactNode;
  csvAvailable?: boolean;
  requiresPlan?: 'analytics' | 'dev-portal';
}

const REPORTS: ReportDef[] = [
  {
    id: 'analytics-overview',
    name: 'Franchise Analytics',
    description: 'Sales, margins, rankings and multi-month trends across all branches.',
    href: '/analytics',
    category: 'Sales',
    icon: <BarChart3 className="h-5 w-5" />,
    csvAvailable: true,
    requiresPlan: 'analytics',
  },
  {
    id: 'finance-budgets',
    name: 'Budgets & Variance',
    description: 'Budget vs actual sales, COGS and variance across branches.',
    href: '/reports/budgets',
    category: 'Finance',
    icon: <DollarSign className="h-5 w-5" />,
    csvAvailable: true,
    requiresPlan: 'analytics',
  },
  {
    id: 'inventory-stock',
    name: 'Inventory & Stock',
    description: 'Current stock levels, low-stock items, wastage and shrinkage.',
    href: '/inventory',
    category: 'Operations',
    icon: <Package className="h-5 w-5" />,
  },
  {
    id: 'hr-staff-insights',
    name: 'Staff Insights',
    description: 'KPIs, Employee of the Month awards and promotion suggestions.',
    href: '/staff/insights',
    category: 'HR',
    icon: <Users className="h-5 w-5" />,
  },
  {
    id: 'customer-nps',
    name: 'Customer Feedback & NPS',
    description: 'Promoters, passives, detractors and feedback comments.',
    href: '/feedback',
    category: 'Customer',
    icon: <MessageSquare className="h-5 w-5" />,
  },
  {
    id: 'report-subscriptions',
    name: 'Report Subscriptions',
    description: 'Manage automated delivery of shift-end reports, daily/weekly/monthly digests.',
    href: '/reports/subscriptions',
    category: 'Admin',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    id: 'reservations',
    name: 'Reservations & Events',
    description: 'Reservation calendar, deposits and event management.',
    href: '/reservations',
    category: 'Operations',
    icon: <Calendar className="h-5 w-5" />,
  },
  {
    id: 'dev-usage',
    name: 'API Usage & Webhooks',
    description: 'API key usage metrics, webhook delivery logs and failures.',
    href: '/dev/usage',
    category: 'Tech',
    icon: <Code className="h-5 w-5" />,
    requiresPlan: 'dev-portal',
  },
  {
    id: 'finance-overview',
    name: 'Finance Overview',
    description: 'P&L summary, expense tracking and service provider payables.',
    href: '/finance',
    category: 'Finance',
    icon: <TrendingUp className="h-5 w-5" />,
  },
];

const categoryColors: Record<string, string> = {
  Sales: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  Finance: 'bg-green-500/10 text-green-500 border-green-500/20',
  Operations: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  HR: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  Customer: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  Tech: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  Admin: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

export default function ReportsHubPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Reports & Digests"
          subtitle="One place to discover all key reports and analytics across ChefCloud."
        />

        <Card className="p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground">
            <strong>About this hub:</strong> ChefCloud provides comprehensive reporting across
            sales, finance, operations, HR, customer experience and technical integrations.
            Click any report below to view detailed data. Reports marked with &ldquo;CSV export&rdquo; support
            downloading data for external analysis.
          </p>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {REPORTS.map((report) => (
            <Link key={report.id} href={report.href}>
              <Card className="h-full p-6 flex flex-col justify-between hover:border-primary/60 transition-all hover:shadow-lg cursor-pointer">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`p-2 rounded-lg ${
                        categoryColors[report.category] || categoryColors.Admin
                      }`}
                    >
                      {report.icon}
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-xs"
                    >
                      {report.category}
                    </Badge>
                  </div>

                  <h2 className="text-base font-semibold mb-2">
                    {report.name}
                  </h2>

                  <p className="text-sm text-muted-foreground">
                    {report.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  {report.csvAvailable && (
                    <Badge variant="outline" className="text-xs">
                      CSV export
                    </Badge>
                  )}
                  {report.requiresPlan && (
                    <Badge variant="outline" className="text-xs">
                      {report.requiresPlan === 'analytics' ? 'Pro+' : 'Dev'}
                    </Badge>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <Card className="p-6 bg-muted/30">
          <h3 className="text-sm font-semibold mb-2">For Tapas Demo Users</h3>
          <p className="text-sm text-muted-foreground mb-3">
            All reports contain rich demo data for November 2024:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li><strong>Franchise Analytics:</strong> 2 branches, 30 days of sales, waste/shrinkage rankings</li>
            <li><strong>Budgets & Variance:</strong> CBD (+3.2%) and Kololo (+12.3%) performance</li>
            <li><strong>Staff Insights:</strong> Asha (Employee of the Month), Ruth (promotion candidate)</li>
            <li><strong>Customer Feedback:</strong> 45+ feedback entries, NPS of 62</li>
            <li><strong>Inventory:</strong> 50+ items with realistic COGS and wastage</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
