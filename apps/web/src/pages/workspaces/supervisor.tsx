/**
 * M8.1: Supervisor Workspace
 */
import { WorkspacePlaceholder } from '@/components/workspace/WorkspacePlaceholder';

export default function SupervisorWorkspace() {
  return (
    <WorkspacePlaceholder
      expectedRole="SUPERVISOR"
      customLinks={[
        { label: 'Dashboard', href: '/dashboard', description: 'Shift overview' },
        { label: 'POS', href: '/pos', description: 'Access point of sale' },
        { label: 'Staff', href: '/staff', description: 'View team schedule' },
        { label: 'Reservations', href: '/reservations', description: 'Manage bookings' },
        { label: 'Voids & Discounts', href: '/voids', description: 'Approve transactions' },
        { label: 'End of Day', href: '/eod', description: 'Close out the day' },
      ]}
    />
  );
}
