/**
 * M8.1: Chef Workspace (Kitchen)
 */
import { WorkspacePlaceholder } from '@/components/workspace/WorkspacePlaceholder';

export default function ChefWorkspace() {
  return (
    <WorkspacePlaceholder
      expectedRole="CHEF"
      customLinks={[
        { label: 'Kitchen Display', href: '/kds', description: 'View incoming orders' },
        { label: 'Menu Items', href: '/menu', description: 'Recipe and prep info' },
        { label: 'Inventory', href: '/inventory', description: 'Check ingredient stock' },
        { label: 'Prep List', href: '/prep', description: 'Daily preparation tasks' },
        { label: 'Waste Log', href: '/waste', description: 'Record kitchen waste' },
      ]}
    />
  );
}
