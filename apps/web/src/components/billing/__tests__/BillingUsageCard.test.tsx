import { render, screen } from '@testing-library/react';
import { BillingUsageCard } from '../BillingUsageCard';
import type { BillingUsageDto } from '@/types/billing';

describe('BillingUsageCard', () => {
  it('renders empty state when usage is null', () => {
    render(<BillingUsageCard usage={null} />);
    
    expect(screen.getByText('Usage')).toBeInTheDocument();
    expect(screen.getByText('Usage data not available yet.')).toBeInTheDocument();
  });

  it('renders populated usage with all metrics', () => {
    const mockUsage: BillingUsageDto = {
      window: 'CURRENT_PERIOD',
      periodStartIso: '2024-11-01T00:00:00Z',
      periodEndIso: '2024-12-01T00:00:00Z',
      apiRequestsUsed: 45230,
      apiRequestsLimit: 100000,
      smsUsed: 128,
      smsLimit: 500,
      storageMbUsed: 340,
      storageMbLimit: 1000,
    };

    render(<BillingUsageCard usage={mockUsage} />);

    expect(screen.getByText('Usage')).toBeInTheDocument();
    expect(screen.getByText(/Nov 1, 2024.*Dec 1, 2024/)).toBeInTheDocument();
    expect(screen.getByText('API Requests')).toBeInTheDocument();
    expect(screen.getByText('45,230 / 100,000 requests')).toBeInTheDocument();
    expect(screen.getByText('SMS Messages')).toBeInTheDocument();
    expect(screen.getByText('128 / 500 messages')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByText('340 / 1,000 MB')).toBeInTheDocument();
  });

  it('renders unlimited API requests when limit is null', () => {
    const mockUsage: BillingUsageDto = {
      window: 'CURRENT_PERIOD',
      periodStartIso: '2024-11-01T00:00:00Z',
      periodEndIso: '2024-12-01T00:00:00Z',
      apiRequestsUsed: 250000,
      apiRequestsLimit: null,
      smsUsed: 50,
      smsLimit: 100,
      storageMbUsed: 100,
      storageMbLimit: null,
    };

    render(<BillingUsageCard usage={mockUsage} />);

    expect(screen.getByText('250,000 requests (no limit)')).toBeInTheDocument();
  });

  it('renders unlimited SMS when limit is null', () => {
    const mockUsage: BillingUsageDto = {
      window: 'CURRENT_PERIOD',
      periodStartIso: '2024-11-01T00:00:00Z',
      periodEndIso: '2024-12-01T00:00:00Z',
      apiRequestsUsed: 10000,
      apiRequestsLimit: 50000,
      smsUsed: 5000,
      smsLimit: null,
      storageMbUsed: 100,
      storageMbLimit: null,
    };

    render(<BillingUsageCard usage={mockUsage} />);

    expect(screen.getByText('5,000 messages (no limit)')).toBeInTheDocument();
  });

  it('renders unlimited storage when limit is null', () => {
    const mockUsage: BillingUsageDto = {
      window: 'CURRENT_PERIOD',
      periodStartIso: '2024-11-01T00:00:00Z',
      periodEndIso: '2024-12-01T00:00:00Z',
      apiRequestsUsed: 10000,
      apiRequestsLimit: 50000,
      smsUsed: 100,
      smsLimit: 500,
      storageMbUsed: 2500,
      storageMbLimit: null,
    };

    render(<BillingUsageCard usage={mockUsage} />);

    expect(screen.getByText('2,500 MB (no limit)')).toBeInTheDocument();
  });

  it('formats large numbers with commas', () => {
    const mockUsage: BillingUsageDto = {
      window: 'CURRENT_PERIOD',
      periodStartIso: '2024-10-01T00:00:00Z',
      periodEndIso: '2024-11-01T00:00:00Z',
      apiRequestsUsed: 1234567,
      apiRequestsLimit: 10000000,
      smsUsed: 98765,
      smsLimit: 100000,
      storageMbUsed: 54321,
      storageMbLimit: 100000,
    };

    render(<BillingUsageCard usage={mockUsage} />);

    expect(screen.getByText('1,234,567 / 10,000,000 requests')).toBeInTheDocument();
    expect(screen.getByText('98,765 / 100,000 messages')).toBeInTheDocument();
    expect(screen.getByText('54,321 / 100,000 MB')).toBeInTheDocument();
  });

  it('renders date range correctly for different months', () => {
    const mockUsage: BillingUsageDto = {
      window: 'CURRENT_PERIOD',
      periodStartIso: '2024-01-15T00:00:00Z',
      periodEndIso: '2024-02-15T00:00:00Z',
      apiRequestsUsed: 1000,
      apiRequestsLimit: 10000,
      smsUsed: 50,
      smsLimit: 100,
      storageMbUsed: 100,
      storageMbLimit: 500,
    };

    render(<BillingUsageCard usage={mockUsage} />);

    expect(screen.getByText(/Jan 15, 2024.*Feb 15, 2024/)).toBeInTheDocument();
  });

  it('handles zero usage values', () => {
    const mockUsage: BillingUsageDto = {
      window: 'CURRENT_PERIOD',
      periodStartIso: '2024-12-01T00:00:00Z',
      periodEndIso: '2024-12-31T00:00:00Z',
      apiRequestsUsed: 0,
      apiRequestsLimit: 100000,
      smsUsed: 0,
      smsLimit: 500,
      storageMbUsed: 0,
      storageMbLimit: 1000,
    };

    render(<BillingUsageCard usage={mockUsage} />);

    expect(screen.getByText('0 / 100,000 requests')).toBeInTheDocument();
    expect(screen.getByText('0 / 500 messages')).toBeInTheDocument();
    expect(screen.getByText('0 / 1,000 MB')).toBeInTheDocument();
  });
});
