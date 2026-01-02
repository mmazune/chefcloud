/**
 * M8.1: Owner Workspace
 */
import { WorkspacePlaceholder } from '@/components/workspace/WorkspacePlaceholder';

export default function OwnerWorkspace() {
  return (
    <WorkspacePlaceholder
      expectedRole="OWNER"
      customLinks={[
        { label: 'Dashboard', href: '/dashboard', description: 'View overall business performance' },
        { label: 'Analytics', href: '/analytics', description: 'Deep dive into sales and operations data' },
        { label: 'Finance', href: '/finance', description: 'Track revenue, expenses, and P&L' },
        { label: 'Staff', href: '/staff', description: 'Manage employees and schedules' },
        { label: 'Reports', href: '/reports', description: 'Generate detailed business reports' },
        { label: 'Settings', href: '/settings', description: 'Configure organization settings' },
        { label: 'Service Providers', href: '/service-providers', description: 'Manage vendors and suppliers' },
        { label: 'Inventory', href: '/inventory', description: 'Track stock levels across branches' },
        { label: 'Feedback', href: '/feedback', description: 'Review customer feedback and ratings' },
      ]}
    />
  );
}
