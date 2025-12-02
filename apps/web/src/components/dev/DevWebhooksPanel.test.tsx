/**
 * Tests for DevWebhooksPanel component (E23-DEVPORTAL-FE-S2)
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DevWebhooksPanel } from './DevWebhooksPanel';
import * as useDevWebhooksModule from '@/hooks/useDevWebhooks';
import * as useCreateDevWebhookModule from '@/hooks/useCreateDevWebhook';
import * as useUpdateDevWebhookModule from '@/hooks/useUpdateDevWebhook';
import * as useRotateDevWebhookSecretModule from '@/hooks/useRotateDevWebhookSecret';
import * as useSendDevWebhookTestModule from '@/hooks/useSendDevWebhookTest';
import { DevWebhookEndpointDto } from '@/types/devPortal';

jest.mock('@/hooks/useDevWebhooks');
jest.mock('@/hooks/useCreateDevWebhook');
jest.mock('@/hooks/useUpdateDevWebhook');
jest.mock('@/hooks/useRotateDevWebhookSecret');
jest.mock('@/hooks/useSendDevWebhookTest');
jest.mock('@/components/dev/DevWebhookDeliveryPanel', () => ({
  DevWebhookDeliveryPanel: jest.fn(() => null),
}));

const mockUseDevWebhooks = useDevWebhooksModule.useDevWebhooks as jest.Mock;
const mockUseCreateDevWebhook =
  useCreateDevWebhookModule.useCreateDevWebhook as jest.Mock;
const mockUseUpdateDevWebhook =
  useUpdateDevWebhookModule.useUpdateDevWebhook as jest.Mock;
const mockUseRotateDevWebhookSecret =
  useRotateDevWebhookSecretModule.useRotateDevWebhookSecret as jest.Mock;
const mockUseSendDevWebhookTest =
  useSendDevWebhookTestModule.useSendDevWebhookTest as jest.Mock;

describe('DevWebhooksPanel', () => {
  const mockReload = jest.fn();
  const mockCreateWebhook = jest.fn();
  const mockUpdateWebhook = jest.fn();
  const mockRotateSecret = jest.fn();
  const mockSendTest = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseDevWebhooks.mockReturnValue({
      webhooks: [],
      isLoading: false,
      error: null,
      reload: mockReload,
    });

    mockUseCreateDevWebhook.mockReturnValue({
      isCreating: false,
      error: null,
      createWebhook: mockCreateWebhook,
    });

    mockUseUpdateDevWebhook.mockReturnValue({
      isUpdating: false,
      error: null,
      updateWebhook: mockUpdateWebhook,
    });

    mockUseRotateDevWebhookSecret.mockReturnValue({
      isRotating: false,
      error: null,
      rotateSecret: mockRotateSecret,
    });

    mockUseSendDevWebhookTest.mockReturnValue({
      isSending: false,
      error: null,
      lastResult: null,
      sendTest: mockSendTest,
    });
  });

  it('displays loading state', () => {
    mockUseDevWebhooks.mockReturnValue({
      webhooks: [],
      isLoading: true,
      error: null,
      reload: mockReload,
    });

    render(<DevWebhooksPanel />);

    expect(screen.getByText('Loading webhooks…')).toBeInTheDocument();
  });

  it('displays error state', () => {
    const mockError = new Error('Failed to load');
    mockUseDevWebhooks.mockReturnValue({
      webhooks: [],
      isLoading: false,
      error: mockError,
      reload: mockReload,
    });

    render(<DevWebhooksPanel />);

    expect(
      screen.getByText(/Failed to load webhooks: Failed to load/),
    ).toBeInTheDocument();
  });

  it('displays empty state', () => {
    render(<DevWebhooksPanel />);

    expect(
      screen.getByText(/No webhook endpoints defined yet/),
    ).toBeInTheDocument();
  });

  it('renders webhooks table with data', () => {
    const mockWebhooks: DevWebhookEndpointDto[] = [
      {
        id: '1',
        label: 'Sandbox Webhook',
        url: 'https://example.com/webhook',
        environment: 'SANDBOX',
        status: 'ACTIVE',
        secretSuffix: 'abcd',
        createdAt: '2025-01-01T00:00:00Z',
        lastDeliveryAt: null,
        lastDeliveryStatusCode: null,
      },
      {
        id: '2',
        label: 'Production Webhook',
        url: 'https://prod.example.com/webhook',
        environment: 'PRODUCTION',
        status: 'DISABLED',
        secretSuffix: 'efgh',
        createdAt: '2025-01-02T00:00:00Z',
        lastDeliveryAt: '2025-01-03T00:00:00Z',
        lastDeliveryStatusCode: 200,
      },
    ];

    mockUseDevWebhooks.mockReturnValue({
      webhooks: mockWebhooks,
      isLoading: false,
      error: null,
      reload: mockReload,
    });

    render(<DevWebhooksPanel />);

    expect(screen.getByText('Sandbox Webhook')).toBeInTheDocument();
    expect(screen.getByText('Production Webhook')).toBeInTheDocument();
    expect(
      screen.getByText('https://example.com/webhook'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('https://prod.example.com/webhook'),
    ).toBeInTheDocument();
  });

  it('displays environment badges correctly', () => {
    const mockWebhooks: DevWebhookEndpointDto[] = [
      {
        id: '1',
        label: 'Sandbox',
        url: 'https://example.com/webhook',
        environment: 'SANDBOX',
        status: 'ACTIVE',
        secretSuffix: 'abcd',
        createdAt: '2025-01-01T00:00:00Z',
        lastDeliveryAt: null,
        lastDeliveryStatusCode: null,
      },
      {
        id: '2',
        label: 'Production',
        url: 'https://prod.example.com/webhook',
        environment: 'PRODUCTION',
        status: 'ACTIVE',
        secretSuffix: 'efgh',
        createdAt: '2025-01-02T00:00:00Z',
        lastDeliveryAt: null,
        lastDeliveryStatusCode: null,
      },
    ];

    mockUseDevWebhooks.mockReturnValue({
      webhooks: mockWebhooks,
      isLoading: false,
      error: null,
      reload: mockReload,
    });

    render(<DevWebhooksPanel />);

    const sandboxBadges = screen.getAllByText('SANDBOX');
    const productionBadges = screen.getAllByText('PRODUCTION');

    expect(sandboxBadges.length).toBeGreaterThan(0);
    expect(productionBadges.length).toBeGreaterThan(0);
  });

  it('displays status badges correctly', () => {
    const mockWebhooks: DevWebhookEndpointDto[] = [
      {
        id: '1',
        label: 'Active Webhook',
        url: 'https://example.com/active',
        environment: 'SANDBOX',
        status: 'ACTIVE',
        secretSuffix: 'abcd',
        createdAt: '2025-01-01T00:00:00Z',
        lastDeliveryAt: null,
        lastDeliveryStatusCode: null,
      },
      {
        id: '2',
        label: 'Disabled Webhook',
        url: 'https://example.com/disabled',
        environment: 'SANDBOX',
        status: 'DISABLED',
        secretSuffix: 'efgh',
        createdAt: '2025-01-02T00:00:00Z',
        lastDeliveryAt: null,
        lastDeliveryStatusCode: null,
      },
    ];

    mockUseDevWebhooks.mockReturnValue({
      webhooks: mockWebhooks,
      isLoading: false,
      error: null,
      reload: mockReload,
    });

    render(<DevWebhooksPanel />);

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('displays truncated secret suffix', () => {
    const mockWebhooks: DevWebhookEndpointDto[] = [
      {
        id: '1',
        label: 'Test',
        url: 'https://example.com/webhook',
        environment: 'SANDBOX',
        status: 'ACTIVE',
        secretSuffix: 'xyz1',
        createdAt: '2025-01-01T00:00:00Z',
        lastDeliveryAt: null,
        lastDeliveryStatusCode: null,
      },
    ];

    mockUseDevWebhooks.mockReturnValue({
      webhooks: mockWebhooks,
      isLoading: false,
      error: null,
      reload: mockReload,
    });

    render(<DevWebhooksPanel />);

    expect(screen.getByText('****xyz1')).toBeInTheDocument();
  });

  it('displays last delivery information', () => {
    const mockWebhooks: DevWebhookEndpointDto[] = [
      {
        id: '1',
        label: 'Test',
        url: 'https://example.com/webhook',
        environment: 'SANDBOX',
        status: 'ACTIVE',
        secretSuffix: 'abcd',
        createdAt: '2025-01-01T00:00:00Z',
        lastDeliveryAt: '2025-01-03T12:00:00Z',
        lastDeliveryStatusCode: 200,
      },
      {
        id: '2',
        label: 'Never delivered',
        url: 'https://example.com/never',
        environment: 'SANDBOX',
        status: 'ACTIVE',
        secretSuffix: 'efgh',
        createdAt: '2025-01-01T00:00:00Z',
        lastDeliveryAt: null,
        lastDeliveryStatusCode: null,
      },
    ];

    mockUseDevWebhooks.mockReturnValue({
      webhooks: mockWebhooks,
      isLoading: false,
      error: null,
      reload: mockReload,
    });

    render(<DevWebhooksPanel />);

    expect(screen.getByText(/200/)).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('opens create modal when "New endpoint" is clicked', async () => {
    render(<DevWebhooksPanel />);

    const newButton = screen.getByText('New endpoint');
    fireEvent.click(newButton);

    await waitFor(() => {
      expect(screen.getByText('New webhook endpoint')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText(/Pourify production/)).toBeInTheDocument();
  });

  it('opens edit modal when "Edit" is clicked', async () => {
    const mockWebhooks: DevWebhookEndpointDto[] = [
      {
        id: '1',
        label: 'Test Webhook',
        url: 'https://example.com/webhook',
        environment: 'SANDBOX',
        status: 'ACTIVE',
        secretSuffix: 'abcd',
        createdAt: '2025-01-01T00:00:00Z',
        lastDeliveryAt: null,
        lastDeliveryStatusCode: null,
      },
    ];

    mockUseDevWebhooks.mockReturnValue({
      webhooks: mockWebhooks,
      isLoading: false,
      error: null,
      reload: mockReload,
    });

    render(<DevWebhooksPanel />);

    const editButton = screen.getByText('Edit');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit webhook endpoint')).toBeInTheDocument();
    });

    const labelInput = screen.getByDisplayValue('Test Webhook');
    expect(labelInput).toBeInTheDocument();
  });

  it('displays test result after sending test event', () => {
    mockUseSendDevWebhookTest.mockReturnValue({
      isSending: false,
      error: null,
      lastResult: {
        deliveryId: 'del_123',
        statusCode: 200,
      },
      sendTest: mockSendTest,
    });

    render(<DevWebhooksPanel />);

    expect(screen.getByText('Last test delivery')).toBeInTheDocument();
    expect(screen.getByText(/del_123/)).toBeInTheDocument();
    expect(screen.getByText(/Status: 200/)).toBeInTheDocument();
  });

  it('displays error message in test result', () => {
    mockUseSendDevWebhookTest.mockReturnValue({
      isSending: false,
      error: null,
      lastResult: {
        deliveryId: 'del_error',
        statusCode: 500,
        errorMessage: 'Connection timeout',
      },
      sendTest: mockSendTest,
    });

    render(<DevWebhooksPanel />);

    expect(screen.getByText(/Connection timeout/)).toBeInTheDocument();
  });

  it('renders "View log" button for webhook endpoints (E23-S3)', async () => {
    const mockWebhook: DevWebhookEndpointDto = {
      id: 'wh_test',
      label: 'Test Webhook',
      url: 'https://example.com/hook',
      environment: 'SANDBOX',
      status: 'ACTIVE',
      secretSuffix: 'abc',
      createdAt: '2024-01-01T00:00:00Z',
      lastDeliveryAt: null,
      lastDeliveryStatusCode: null,
    };

    mockUseDevWebhooks.mockReturnValue({
      webhooks: [mockWebhook],
      isLoading: false,
      error: null,
      reload: mockReload,
    });

    render(<DevWebhooksPanel />);

    await waitFor(() => {
      expect(screen.getByText('View log')).toBeInTheDocument();
    });
  });
});
