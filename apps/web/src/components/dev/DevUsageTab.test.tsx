/**
 * Unit tests for DevUsageTab component (E23-DEVPORTAL-FE-S5)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DevUsageTab } from './DevUsageTab';
import * as useDevUsageSummaryHook from '@/hooks/useDevUsageSummary';

jest.mock('@/hooks/useDevUsageSummary');
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

const mockUseDevUsageSummary = useDevUsageSummaryHook.useDevUsageSummary as jest.MockedFunction<
  typeof useDevUsageSummaryHook.useDevUsageSummary
>;

describe('DevUsageTab', () => {
  const mockReload = jest.fn();
  const mockSetRange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state', () => {
    mockUseDevUsageSummary.mockReturnValue({
      range: '24h',
      setRange: mockSetRange,
      summary: null,
      isLoading: true,
      error: null,
      reload: mockReload,
    });

    render(<DevUsageTab />);

    expect(screen.getByText('Loading usage…')).toBeInTheDocument();
    expect(screen.getByText('API usage and error rates')).toBeInTheDocument();
  });

  it('should render error state', () => {
    const mockError = new Error('Failed to load usage');
    mockUseDevUsageSummary.mockReturnValue({
      range: '24h',
      setRange: mockSetRange,
      summary: null,
      isLoading: false,
      error: mockError,
      reload: mockReload,
    });

    render(<DevUsageTab />);

    expect(screen.getByText(/Failed to load usage/)).toBeInTheDocument();
    expect(screen.getByText(/Failed to load usage: Failed to load usage/)).toBeInTheDocument();
  });

  it('should render summary cards with data', () => {
    const mockSummary = {
      fromIso: '2025-12-01T10:00:00.000Z',
      toIso: '2025-12-02T10:00:00.000Z',
      range: '24h' as const,
      totalRequests: 1024,
      totalErrors: 32,
      errorRatePercent: 3.125,
      sandboxRequests: 512,
      productionRequests: 512,
      timeseries: [],
      topKeys: [],
    };

    mockUseDevUsageSummary.mockReturnValue({
      range: '24h',
      setRange: mockSetRange,
      summary: mockSummary,
      isLoading: false,
      error: null,
      reload: mockReload,
    });

    render(<DevUsageTab />);

    expect(screen.getByText('Total requests')).toBeInTheDocument();
    expect(screen.getByText('1,024')).toBeInTheDocument();
    expect(screen.getByText('Total errors')).toBeInTheDocument();
    expect(screen.getByText('32')).toBeInTheDocument();
    expect(screen.getByText('3.13% error rate')).toBeInTheDocument();
    expect(screen.getByText('Sandbox')).toBeInTheDocument();
    expect(screen.getAllByText('512').length).toBeGreaterThan(0);
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('should render "no timeseries" message when timeseries is empty', () => {
    const mockSummary = {
      fromIso: '2025-12-01T10:00:00.000Z',
      toIso: '2025-12-02T10:00:00.000Z',
      range: '24h' as const,
      totalRequests: 100,
      totalErrors: 5,
      errorRatePercent: 5.0,
      sandboxRequests: 50,
      productionRequests: 50,
      timeseries: [],
      topKeys: [],
    };

    mockUseDevUsageSummary.mockReturnValue({
      range: '24h',
      setRange: mockSetRange,
      summary: mockSummary,
      isLoading: false,
      error: null,
      reload: mockReload,
    });

    render(<DevUsageTab />);

    expect(screen.getByText('No timeseries data available yet.')).toBeInTheDocument();
  });

  it('should render chart when timeseries has data', () => {
    const mockSummary = {
      fromIso: '2025-12-01T10:00:00.000Z',
      toIso: '2025-12-02T10:00:00.000Z',
      range: '24h' as const,
      totalRequests: 240,
      totalErrors: 10,
      errorRatePercent: 4.17,
      sandboxRequests: 120,
      productionRequests: 120,
      timeseries: [
        { timestamp: '2025-12-02T08:00:00.000Z', requestCount: 50, errorCount: 2 },
        { timestamp: '2025-12-02T09:00:00.000Z', requestCount: 60, errorCount: 3 },
      ],
      topKeys: [],
    };

    mockUseDevUsageSummary.mockReturnValue({
      range: '24h',
      setRange: mockSetRange,
      summary: mockSummary,
      isLoading: false,
      error: null,
      reload: mockReload,
    });

    render(<DevUsageTab />);

    expect(screen.queryByText('No timeseries data available yet.')).not.toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('should render "no activity" message when topKeys is empty', () => {
    const mockSummary = {
      fromIso: '2025-12-01T10:00:00.000Z',
      toIso: '2025-12-02T10:00:00.000Z',
      range: '24h' as const,
      totalRequests: 0,
      totalErrors: 0,
      errorRatePercent: 0,
      sandboxRequests: 0,
      productionRequests: 0,
      timeseries: [],
      topKeys: [],
    };

    mockUseDevUsageSummary.mockReturnValue({
      range: '24h',
      setRange: mockSetRange,
      summary: mockSummary,
      isLoading: false,
      error: null,
      reload: mockReload,
    });

    render(<DevUsageTab />);

    expect(screen.getByText('No API key activity recorded in this time range.')).toBeInTheDocument();
  });

  it('should render top keys table with data', () => {
    const mockSummary = {
      fromIso: '2025-12-01T10:00:00.000Z',
      toIso: '2025-12-02T10:00:00.000Z',
      range: '24h' as const,
      totalRequests: 1144,
      totalErrors: 32,
      errorRatePercent: 2.8,
      sandboxRequests: 342,
      productionRequests: 802,
      timeseries: [],
      topKeys: [
        {
          keyId: 'key-1',
          label: 'Production App',
          environment: 'PRODUCTION' as const,
          requestCount: 802,
          errorCount: 20,
        },
        {
          keyId: 'key-2',
          label: 'Test Key',
          environment: 'SANDBOX' as const,
          requestCount: 342,
          errorCount: 12,
        },
      ],
    };

    mockUseDevUsageSummary.mockReturnValue({
      range: '24h',
      setRange: mockSetRange,
      summary: mockSummary,
      isLoading: false,
      error: null,
      reload: mockReload,
    });

    render(<DevUsageTab />);

    expect(screen.getByText('Production App')).toBeInTheDocument();
    expect(screen.getByText('Test Key')).toBeInTheDocument();
    expect(screen.getByText('PRODUCTION')).toBeInTheDocument();
    expect(screen.getByText('SANDBOX')).toBeInTheDocument();
    expect(screen.getAllByText('802').length).toBeGreaterThan(0);
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);
    expect(screen.getAllByText('342').length).toBeGreaterThan(0);
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
    
    // Check error rates
    expect(screen.getByText('2.49%')).toBeInTheDocument(); // 20/802 * 100
    expect(screen.getByText('3.51%')).toBeInTheDocument(); // 12/342 * 100
  });

  it('should call setRange when range button is clicked', () => {
    const mockSummary = {
      fromIso: '2025-12-01T10:00:00.000Z',
      toIso: '2025-12-02T10:00:00.000Z',
      range: '24h' as const,
      totalRequests: 100,
      totalErrors: 5,
      errorRatePercent: 5.0,
      sandboxRequests: 50,
      productionRequests: 50,
      timeseries: [],
      topKeys: [],
    };

    mockUseDevUsageSummary.mockReturnValue({
      range: '24h',
      setRange: mockSetRange,
      summary: mockSummary,
      isLoading: false,
      error: null,
      reload: mockReload,
    });

    render(<DevUsageTab />);

    const sevenDayButton = screen.getByText('Last 7 days');
    fireEvent.click(sevenDayButton);

    expect(mockSetRange).toHaveBeenCalledWith('7d');
  });

  it('should call reload when Refresh button is clicked', () => {
    const mockSummary = {
      fromIso: '2025-12-01T10:00:00.000Z',
      toIso: '2025-12-02T10:00:00.000Z',
      range: '24h' as const,
      totalRequests: 100,
      totalErrors: 5,
      errorRatePercent: 5.0,
      sandboxRequests: 50,
      productionRequests: 50,
      timeseries: [],
      topKeys: [],
    };

    mockUseDevUsageSummary.mockReturnValue({
      range: '24h',
      setRange: mockSetRange,
      summary: mockSummary,
      isLoading: false,
      error: null,
      reload: mockReload,
    });

    render(<DevUsageTab />);

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    expect(mockReload).toHaveBeenCalled();
  });

  it('should highlight active range button', () => {
    const mockSummary = {
      fromIso: '2025-12-01T10:00:00.000Z',
      toIso: '2025-12-02T10:00:00.000Z',
      range: '7d' as const,
      totalRequests: 5000,
      totalErrors: 100,
      errorRatePercent: 2.0,
      sandboxRequests: 2500,
      productionRequests: 2500,
      timeseries: [],
      topKeys: [],
    };

    mockUseDevUsageSummary.mockReturnValue({
      range: '7d',
      setRange: mockSetRange,
      summary: mockSummary,
      isLoading: false,
      error: null,
      reload: mockReload,
    });

    render(<DevUsageTab />);

    const sevenDayButton = screen.getByText('Last 7 days');
    expect(sevenDayButton).toHaveClass('bg-slate-100');
    expect(sevenDayButton).toHaveClass('text-slate-900');

    const twentyFourHourButton = screen.getByText('Last 24h');
    expect(twentyFourHourButton).toHaveClass('text-slate-300');
    expect(twentyFourHourButton).not.toHaveClass('bg-slate-100');
  });

  it('should disable Refresh button when loading', () => {
    mockUseDevUsageSummary.mockReturnValue({
      range: '24h',
      setRange: mockSetRange,
      summary: null,
      isLoading: true,
      error: null,
      reload: mockReload,
    });

    render(<DevUsageTab />);

    const refreshButton = screen.getByText('Refresh');
    expect(refreshButton).toBeDisabled();
  });
});
