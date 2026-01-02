/**
 * M8.1: Manager Workspace
 */
import { WorkspacePlaceholder } from '@/components/workspace/WorkspacePlaceholder';

export default function ManagerWorkspace() {
  return (
    <WorkspacePlaceholder
      expectedRole="MANAGER"
      customLinks={[
        { label: 'Dashboard', href: '/dashboard', description: 'View daily performance metrics' },
        { label: 'Staff', href: '/staff', description: 'Manage team schedules and shifts' },
        { label: 'Analytics', href: '/analytics', description: 'Track sales and operational KPIs' },
        { label: 'POS', href: '/pos', description: 'Access point of sale' },
        { label: 'Inventory', href: '/inventory', description: 'Monitor stock levels' },
        { label: 'Reservations', href: '/reservations', description: 'Manage bookings and tables' },
        { label: 'Reports', href: '/reports', description: 'Generate daily and weekly reports' },
        { label: 'Feedback', href: '/feedback', description: 'Review customer satisfaction' },
        { label: 'Settings', href: '/settings', description: 'Configure branch settings' },
      ]}
    />
  );
}
