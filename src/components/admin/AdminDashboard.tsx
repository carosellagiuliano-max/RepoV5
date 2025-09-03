import { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { CalendarView } from './CalendarView';
import { CalendarPro } from '../../admin/appointments/CalendarPro';
import { CustomerManagement } from './CustomerManagement';
import { FinancialOverview } from './FinancialOverview';
import { InactiveCustomers } from './InactiveCustomers';
import { AdminSettings } from './AdminSettings';
import { MediaManagement } from '../../admin/media/MediaManagement';
import { AnalyticsOverview } from '../../admin/analytics/AnalyticsOverview';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface AdminDashboardProps {
  onLogout: () => void;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeView, setActiveView] = useState<'calendar' | 'calendar-pro' | 'customers' | 'finances' | 'inactive' | 'media' | 'settings' | 'analytics'>('calendar-pro');

  return (
    <div className="flex h-screen bg-background">
      <AdminSidebar activeView={activeView} onViewChange={setActiveView} />
      
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b bg-card p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            {activeView === 'calendar' && 'Terminkalender'}
            {activeView === 'calendar-pro' && 'Terminkalender Pro'}
            {activeView === 'customers' && 'Kundenverwaltung'}
            {activeView === 'finances' && 'Finanzübersicht'}
            {activeView === 'inactive' && 'Inaktive Kunden'}
            {activeView === 'media' && 'Medienverwaltung'}
            {activeView === 'settings' && 'Einstellungen'}
            {activeView === 'analytics' && 'Analytics Dashboard'}
          </h1>
          <Button variant="outline" onClick={onLogout} className="gap-2">
            <LogOut className="w-4 h-4" />
            Abmelden
          </Button>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {activeView === 'calendar' && <CalendarView />}
          {activeView === 'calendar-pro' && <CalendarPro />}
          {activeView === 'customers' && <CustomerManagement />}
          {activeView === 'finances' && <FinancialOverview />}
          {activeView === 'inactive' && <InactiveCustomers />}
          {activeView === 'media' && <MediaManagement />}
          {activeView === 'settings' && <AdminSettings />}
          {activeView === 'analytics' && <AnalyticsOverview />}
        </main>
      </div>
    </div>
  );
}