import { WorkspacePlaceholder } from '@/components/workspace/WorkspacePlaceholder';

export default function BartenderWorkspace() {
  return (
    <WorkspacePlaceholder
      expectedRole="BARTENDER"
      customLinks={[
        {
          label: 'POS',
          href: '/pos',
          description: 'Process bar orders and tabs',
        },
        {
          label: 'Inventory',
          href: '/inventory',
          description: 'Track bar stock and supplies',
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
