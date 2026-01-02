/**
 * M8.1: Procurement Workspace
 */
import { WorkspacePlaceholder } from '@/components/workspace/WorkspacePlaceholder';

export default function ProcurementWorkspace() {
  return (
    <WorkspacePlaceholder
      expectedRole="PROCUREMENT"
      customLinks={[
        { label: 'Procurement Dashboard', href: '/dashboard/procurement', description: 'Purchasing overview' },
        { label: 'Suppliers', href: '/suppliers', description: 'Manage supplier relationships' },
        { label: 'Purchase Orders', href: '/purchase-orders', description: 'Create and track POs' },
        { label: 'Inventory', href: '/inventory', description: 'Monitor stock levels' },
        { label: 'Invoices', href: '/invoices', description: 'Match invoices to deliveries' },
        { label: 'Reports', href: '/reports', description: 'Procurement analytics' },
      ]}
    />
  );
}
