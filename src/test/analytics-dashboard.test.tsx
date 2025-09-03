import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnalyticsOverview } from '@/admin/analytics/AnalyticsOverview';

// Mock the admin request function
vi.mock('@/lib/admin-request', () => ({
  adminRequest: vi.fn(() => Promise.resolve({
    success: true,
    data: {
      summary: {
        totalBookings: 1247,
        totalRevenue: 32580,
        activeCustomers: 892,
        averageBookingValue: 26.14,
      },
    },
  })),
}));

describe('Analytics Dashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderAnalytics = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AnalyticsOverview />
      </QueryClientProvider>
    );
  };

  it('should render analytics dashboard header', () => {
    renderAnalytics();
    
    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Comprehensive business insights and performance metrics')).toBeInTheDocument();
  });

  it('should display summary cards with mock data', () => {
    renderAnalytics();
    
    // Check for summary cards
    expect(screen.getByText('Gesamte Termine')).toBeInTheDocument();
    expect(screen.getByText('Gesamtumsatz')).toBeInTheDocument();
    expect(screen.getByText('Aktive Kunden')).toBeInTheDocument();
    expect(screen.getByText('Ø Terminwert')).toBeInTheDocument();
    
    // Check for mock data values
    expect(screen.getByText('1.247')).toBeInTheDocument();
    expect(screen.getByText('892')).toBeInTheDocument();
  });

  it('should have functional tabs', async () => {
    renderAnalytics();
    
    // Check default tab
    expect(screen.getByText('Aktuelle Performance')).toBeInTheDocument();
    
    // Click on Services tab
    const servicesTab = screen.getByRole('tab', { name: 'Services' });
    fireEvent.click(servicesTab);
    
    await waitFor(() => {
      expect(screen.getByText('Service Performance')).toBeInTheDocument();
    });
    
    // Click on Staff tab
    const staffTab = screen.getByRole('tab', { name: 'Mitarbeiter' });
    fireEvent.click(staffTab);
    
    await waitFor(() => {
      expect(screen.getByText('Mitarbeiter Performance')).toBeInTheDocument();
    });
  });

  it('should have time period filter', () => {
    renderAnalytics();
    
    expect(screen.getByText('Zeitraum')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Letzte 30 Tage')).toBeInTheDocument();
  });

  it('should show custom date inputs when custom period is selected', async () => {
    renderAnalytics();
    
    // Find and click the time period select
    const timeSelect = screen.getByRole('combobox');
    fireEvent.click(timeSelect);
    
    // Select custom option
    const customOption = screen.getByText('Benutzerdefiniert');
    fireEvent.click(customOption);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Von')).toBeInTheDocument();
      expect(screen.getByLabelText('Bis')).toBeInTheDocument();
    });
  });

  it('should display live data badge', () => {
    renderAnalytics();
    
    expect(screen.getByText('Live Data')).toBeInTheDocument();
  });

  it('should have refresh functionality', () => {
    renderAnalytics();
    
    const refreshButton = screen.getByRole('button', { name: /aktualisieren/i });
    expect(refreshButton).toBeInTheDocument();
    
    fireEvent.click(refreshButton);
    
    // Should show loading state briefly
    expect(screen.getByText('Aktualisiert...')).toBeInTheDocument();
  });

  it('should display top services with mock data', () => {
    renderAnalytics();
    
    // Click on Services tab to see service data
    const servicesTab = screen.getByRole('tab', { name: 'Services' });
    fireEvent.click(servicesTab);
    
    expect(screen.getByText('Damenschnitt')).toBeInTheDocument();
    expect(screen.getByText('Herrenbarber')).toBeInTheDocument();
    expect(screen.getByText('Colorationen')).toBeInTheDocument();
  });

  it('should display staff performance data', () => {
    renderAnalytics();
    
    // Click on Staff tab
    const staffTab = screen.getByRole('tab', { name: 'Mitarbeiter' });
    fireEvent.click(staffTab);
    
    expect(screen.getByText('Maria Schmidt')).toBeInTheDocument();
    expect(screen.getByText('Thomas Weber')).toBeInTheDocument();
    expect(screen.getByText('Anna Fischer')).toBeInTheDocument();
  });

  it('should show trends visualization placeholder', async () => {
    renderAnalytics();
    
    // Click on Trends tab
    const trendsTab = screen.getByRole('tab', { name: 'Trends' });
    fireEvent.click(trendsTab);
    
    await waitFor(() => {
      expect(screen.getByText('Trend-Analyse')).toBeInTheDocument();
    });
  });

  it('should format currency values correctly', () => {
    renderAnalytics();
    
    // Check for Euro formatting
    expect(screen.getByText('32.580,00 €')).toBeInTheDocument();
    expect(screen.getByText('26,14 €')).toBeInTheDocument();
  });

  it('should show percentage changes with trend indicators', () => {
    renderAnalytics();
    
    // Should show multiple trend indicators (getAllByText should find all instances)
    const trendTexts = screen.getAllByText(/gegenüber Vorperiode/);
    expect(trendTexts.length).toBeGreaterThan(0);
  });
});