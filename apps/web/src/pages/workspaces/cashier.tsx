import { WorkspacePlaceholder } from '@/components/workspace/WorkspacePlaceholder';

export default function CashierWorkspace() {
  return (
    <WorkspacePlaceholder
      expectedRole="CASHIER"
      customLinks={[
        {
          label: 'POS',
          href: '/pos',
          description: 'Process transactions and payments',
        },
        {
          label: 'Dashboard',
          href: '/dashboard',
          description: 'View sales and performance metrics',
        },
        {
          label: 'Timeclock',
          href: '/workforce/timeclock',
          description: 'Clock in and out of shifts',
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
      ]}
    />
  );
}
