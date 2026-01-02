/**
 * M8.1: Stock Manager Workspace
 */
import { WorkspacePlaceholder } from '@/components/workspace/WorkspacePlaceholder';

export default function StockManagerWorkspace() {
  return (
    <WorkspacePlaceholder
      expectedRole="STOCK_MANAGER"
      customLinks={[
        { label: 'Inventory Dashboard', href: '/dashboard/inventory', description: 'Stock level overview' },
        { label: 'Inventory', href: '/inventory', description: 'Manage stock items' },
        { label: 'Stock Counts', href: '/stock-counts', description: 'Perform physical counts' },
        { label: 'Waste Log', href: '/waste', description: 'Track waste and spoilage' },
        { label: 'Transfers', href: '/transfers', description: 'Inter-branch transfers' },
        { label: 'Low Stock Alerts', href: '/alerts/low-stock', description: 'Items needing reorder' },
        { label: 'Reports', href: '/reports', description: 'Inventory analytics' },
      ]}
    />
  );
}
