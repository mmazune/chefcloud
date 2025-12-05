import React from 'react';
import { render, screen } from '@testing-library/react';
import BillingPage from '@/pages/billing';
import { useBillingOverview } from '@/hooks/useBillingOverview';

jest.mock('@/hooks/useBillingOverview');
const mockUseBillingOverview = useBillingOverview as jest.Mock;

test('billing page exposes main landmark with main-content id', () => {
  mockUseBillingOverview.mockReturnValue({
    plans: [],
    subscription: null,
    usage: null,
    isLoading: false,
    error: null,
    reload: jest.fn(),
  });

  render(<BillingPage />);

  const main = screen.getByRole('main');
  expect(main).toHaveAttribute('id', 'main-content');
});
