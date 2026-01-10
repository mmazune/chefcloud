import { WorkspacePlaceholder } from '@/components/workspace/WorkspacePlaceholder';

export default function WaiterWorkspace() {
  return (
    <WorkspacePlaceholder
      expectedRole="WAITER"
      customLinks={[
        {
          label: 'POS',
          href: '/pos',
          description: 'Take orders and process payments',
        },
        {
          label: 'Reservations',
          href: '/reservations',
          description: 'View and manage table reservations',
        },
        {
          label: 'My Availability',
          href: '/workforce/my-availability',
          description: 'Set your availability preferences',
        },
        {
          label: 'My Swaps',
          href: '/workforce/my-swaps',
          description: 'Request and manage shift swaps',
        },
        {
          label: 'Open Shifts',
          href: '/workforce/open-shifts',
          description: 'Pick up available shifts',
        },
        {
          label: 'Settings',
          href: '/settings',
          description: 'Configure your preferences',
        },
      ]}
    />
  );
}
