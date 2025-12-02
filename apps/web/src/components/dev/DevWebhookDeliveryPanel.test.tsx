/**
 * Unit tests for DevWebhookDeliveryPanel component (E23-S3)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DevWebhookDeliveryPanel } from './DevWebhookDeliveryPanel';
import * as useDevWebhookDeliveriesHook from '@/hooks/useDevWebhookDeliveries';
import * as useRetryDevWebhookDeliveryHook from '@/hooks/useRetryDevWebhookDelivery';

jest.mock('@/hooks/useDevWebhookDeliveries');
jest.mock('@/hooks/useRetryDevWebhookDelivery');

const mockUseDevWebhookDeliveries =
  useDevWebhookDeliveriesHook.useDevWebhookDeliveries as jest.Mock;
const mockUseRetryDevWebhookDelivery =
  useRetryDevWebhookDeliveryHook.useRetryDevWebhookDelivery as jest.Mock;

const mockEndpoint = {
  id: 'ep123',
  label: 'Production Orders',
  url: 'https://example.com/webhooks',
  environment: 'PRODUCTION' as const,
  status: 'ACTIVE' as const,
  secretSuffix: 'abcd',
  createdAt: '2024-01-01T00:00:00Z',
  lastDeliveryAt: null,
  lastDeliveryStatusCode: null,
};

describe('DevWebhookDeliveryPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    mockUseDevWebhookDeliveries.mockReturnValue({
      deliveries: [],
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });
    mockUseRetryDevWebhookDelivery.mockReturnValue({
      isRetrying: false,
      error: null,
      retry: jest.fn(),
    });

    const { container } = render(
      <DevWebhookDeliveryPanel
        endpoint={mockEndpoint}
        isOpen={false}
        onClose={jest.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('should not render when endpoint is null', () => {
    mockUseDevWebhookDeliveries.mockReturnValue({
      deliveries: [],
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });
    mockUseRetryDevWebhookDelivery.mockReturnValue({
      isRetrying: false,
      error: null,
      retry: jest.fn(),
    });

    const { container } = render(
      <DevWebhookDeliveryPanel endpoint={null} isOpen={true} onClose={jest.fn()} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render loading state', () => {
    mockUseDevWebhookDeliveries.mockReturnValue({
      deliveries: [],
      isLoading: true,
      error: null,
      reload: jest.fn(),
    });
    mockUseRetryDevWebhookDelivery.mockReturnValue({
      isRetrying: false,
      error: null,
      retry: jest.fn(),
    });

    render(
      <DevWebhookDeliveryPanel
        endpoint={mockEndpoint}
        isOpen={true}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Loading deliveries…')).toBeInTheDocument();
  });

  it('should render error state', () => {
    mockUseDevWebhookDeliveries.mockReturnValue({
      deliveries: [],
      isLoading: false,
      error: new Error('Network error'),
      reload: jest.fn(),
    });
    mockUseRetryDevWebhookDelivery.mockReturnValue({
      isRetrying: false,
      error: null,
      retry: jest.fn(),
    });

    render(
      <DevWebhookDeliveryPanel
        endpoint={mockEndpoint}
        isOpen={true}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText(/Failed to load deliveries: Network error/)).toBeInTheDocument();
  });

  it('should render empty state', () => {
    mockUseDevWebhookDeliveries.mockReturnValue({
      deliveries: [],
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });
    mockUseRetryDevWebhookDelivery.mockReturnValue({
      isRetrying: false,
      error: null,
      retry: jest.fn(),
    });

    render(
      <DevWebhookDeliveryPanel
        endpoint={mockEndpoint}
        isOpen={true}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText(/No deliveries found for this endpoint yet/)).toBeInTheDocument();
  });

  it('should render deliveries table', () => {
    const mockDeliveries = [
      {
        id: 'del1',
        endpointId: 'ep123',
        environment: 'PRODUCTION' as const,
        eventType: 'order.created',
        status: 'SUCCESS' as const,
        statusCode: 200,
        createdAt: '2024-01-01T00:00:00Z',
        deliveredAt: '2024-01-01T00:00:01Z',
        attemptCount: 1,
        lastErrorMessage: null,
        durationMs: 120,
      },
      {
        id: 'del2',
        endpointId: 'ep123',
        environment: 'PRODUCTION' as const,
        eventType: 'order.updated',
        status: 'FAILED' as const,
        statusCode: 500,
        createdAt: '2024-01-01T00:01:00Z',
        deliveredAt: '2024-01-01T00:01:01Z',
        attemptCount: 3,
        lastErrorMessage: 'Connection timeout',
        durationMs: null,
      },
    ];

    mockUseDevWebhookDeliveries.mockReturnValue({
      deliveries: mockDeliveries,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });
    mockUseRetryDevWebhookDelivery.mockReturnValue({
      isRetrying: false,
      error: null,
      retry: jest.fn(),
    });

    render(
      <DevWebhookDeliveryPanel
        endpoint={mockEndpoint}
        isOpen={true}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('order.created')).toBeInTheDocument();
    expect(screen.getByText('order.updated')).toBeInTheDocument();
    expect(screen.getAllByText('Success').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Failed').length).toBeGreaterThan(0);
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('120 ms')).toBeInTheDocument();
    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
  });

  it('should render stats correctly', () => {
    const mockDeliveries = [
      {
        id: 'del1',
        endpointId: 'ep123',
        environment: 'PRODUCTION' as const,
        eventType: 'order.created',
        status: 'SUCCESS' as const,
        statusCode: 200,
        createdAt: '2024-01-01T00:00:00Z',
        deliveredAt: '2024-01-01T00:00:01Z',
        attemptCount: 1,
        lastErrorMessage: null,
        durationMs: 120,
      },
      {
        id: 'del2',
        endpointId: 'ep123',
        environment: 'PRODUCTION' as const,
        eventType: 'order.updated',
        status: 'FAILED' as const,
        statusCode: 500,
        createdAt: '2024-01-01T00:01:00Z',
        deliveredAt: '2024-01-01T00:01:01Z',
        attemptCount: 3,
        lastErrorMessage: 'Connection timeout',
        durationMs: null,
      },
      {
        id: 'del3',
        endpointId: 'ep123',
        environment: 'PRODUCTION' as const,
        eventType: 'order.cancelled',
        status: 'PENDING' as const,
        statusCode: null,
        createdAt: '2024-01-01T00:02:00Z',
        deliveredAt: null,
        attemptCount: 0,
        lastErrorMessage: null,
        durationMs: null,
      },
    ];

    mockUseDevWebhookDeliveries.mockReturnValue({
      deliveries: mockDeliveries,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });
    mockUseRetryDevWebhookDelivery.mockReturnValue({
      isRetrying: false,
      error: null,
      retry: jest.fn(),
    });

    render(
      <DevWebhookDeliveryPanel
        endpoint={mockEndpoint}
        isOpen={true}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText(/Total:/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/Success:/)).toBeInTheDocument();
    expect(screen.getAllByText('1')[0]).toBeInTheDocument();
    expect(screen.getByText(/Failed:/)).toBeInTheDocument();
  });

  it('should show retry button only for FAILED deliveries', () => {
    const mockDeliveries = [
      {
        id: 'del1',
        endpointId: 'ep123',
        environment: 'PRODUCTION' as const,
        eventType: 'order.created',
        status: 'SUCCESS' as const,
        statusCode: 200,
        createdAt: '2024-01-01T00:00:00Z',
        deliveredAt: '2024-01-01T00:00:01Z',
        attemptCount: 1,
        lastErrorMessage: null,
        durationMs: 120,
      },
      {
        id: 'del2',
        endpointId: 'ep123',
        environment: 'PRODUCTION' as const,
        eventType: 'order.updated',
        status: 'FAILED' as const,
        statusCode: 500,
        createdAt: '2024-01-01T00:01:00Z',
        deliveredAt: '2024-01-01T00:01:01Z',
        attemptCount: 3,
        lastErrorMessage: 'Connection timeout',
        durationMs: null,
      },
    ];

    mockUseDevWebhookDeliveries.mockReturnValue({
      deliveries: mockDeliveries,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });
    mockUseRetryDevWebhookDelivery.mockReturnValue({
      isRetrying: false,
      error: null,
      retry: jest.fn(),
    });

    render(
      <DevWebhookDeliveryPanel
        endpoint={mockEndpoint}
        isOpen={true}
        onClose={jest.fn()}
      />,
    );

    const retryButtons = screen.getAllByRole('button', { name: /Retry/i });
    expect(retryButtons).toHaveLength(1);
  });

  it('should call retry when retry button is clicked', async () => {
    const mockRetry = jest.fn().mockResolvedValue({});
    const mockReload = jest.fn();

    mockUseDevWebhookDeliveries.mockReturnValue({
      deliveries: [
        {
          id: 'del1',
          endpointId: 'ep123',
          environment: 'PRODUCTION' as const,
          eventType: 'order.updated',
          status: 'FAILED' as const,
          statusCode: 500,
          createdAt: '2024-01-01T00:01:00Z',
          deliveredAt: '2024-01-01T00:01:01Z',
          attemptCount: 3,
          lastErrorMessage: 'Connection timeout',
          durationMs: null,
        },
      ],
      isLoading: false,
      error: null,
      reload: mockReload,
    });
    mockUseRetryDevWebhookDelivery.mockReturnValue({
      isRetrying: false,
      error: null,
      retry: mockRetry,
    });

    render(
      <DevWebhookDeliveryPanel
        endpoint={mockEndpoint}
        isOpen={true}
        onClose={jest.fn()}
      />,
    );

    const retryButton = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryButton);

    await waitFor(() => expect(mockRetry).toHaveBeenCalledWith('del1'));
  });

  it('should call onClose when close button is clicked', () => {
    mockUseDevWebhookDeliveries.mockReturnValue({
      deliveries: [],
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });
    mockUseRetryDevWebhookDelivery.mockReturnValue({
      isRetrying: false,
      error: null,
      retry: jest.fn(),
    });

    const onClose = jest.fn();

    render(
      <DevWebhookDeliveryPanel
        endpoint={mockEndpoint}
        isOpen={true}
        onClose={onClose}
      />,
    );

    const closeButton = screen.getByRole('button', { name: /Close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call reload when refresh button is clicked', () => {
    const mockReload = jest.fn();

    mockUseDevWebhookDeliveries.mockReturnValue({
      deliveries: [],
      isLoading: false,
      error: null,
      reload: mockReload,
    });
    mockUseRetryDevWebhookDelivery.mockReturnValue({
      isRetrying: false,
      error: null,
      retry: jest.fn(),
    });

    render(
      <DevWebhookDeliveryPanel
        endpoint={mockEndpoint}
        isOpen={true}
        onClose={jest.fn()}
      />,
    );

    const refreshButton = screen.getByRole('button', { name: /Refresh/i });
    fireEvent.click(refreshButton);

    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('should display retry error when retry fails', () => {
    mockUseDevWebhookDeliveries.mockReturnValue({
      deliveries: [],
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });
    mockUseRetryDevWebhookDelivery.mockReturnValue({
      isRetrying: false,
      error: new Error('Retry failed'),
      retry: jest.fn(),
    });

    render(
      <DevWebhookDeliveryPanel
        endpoint={mockEndpoint}
        isOpen={true}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText(/Retry failed: Retry failed/)).toBeInTheDocument();
  });
});
