/**
 * M8.1: Event Manager Workspace
 */
import { WorkspacePlaceholder } from '@/components/workspace/WorkspacePlaceholder';

export default function EventManagerWorkspace() {
  return (
    <WorkspacePlaceholder
      expectedRole="EVENT_MANAGER"
      customLinks={[
        { label: 'Events Dashboard', href: '/dashboard/events', description: 'Upcoming events overview' },
        { label: 'Reservations', href: '/reservations', description: 'Manage bookings' },
        { label: 'Calendar', href: '/calendar', description: 'Event schedule' },
        { label: 'Catering', href: '/catering', description: 'Catering orders' },
        { label: 'Quotes', href: '/quotes', description: 'Event quotes and proposals' },
        { label: 'Contracts', href: '/contracts', description: 'Event agreements' },
        { label: 'Reports', href: '/reports', description: 'Event analytics' },
      ]}
    />
  );
}
