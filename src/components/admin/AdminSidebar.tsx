import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Calendar, Users, TrendingUp, Scissors, Settings, UserX, Image, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminSidebarProps {
  activeView: 'calendar' | 'customers' | 'finances' | 'inactive' | 'media' | 'analytics' | 'settings';
  onViewChange: (view: 'calendar' | 'customers' | 'finances' | 'inactive' | 'media' | 'analytics' | 'settings') => void;
}

export function AdminSidebar({ activeView, onViewChange }: AdminSidebarProps) {
  const menuItems = [
    {
      id: 'calendar' as const,
      label: 'Terminkalender',
      icon: Calendar,
      description: 'Termine verwalten'
    },
    {
      id: 'customers' as const,
      label: 'Kundenverwaltung',
      icon: Users,
      description: 'Kundenstamm'
    },
    {
      id: 'finances' as const,
      label: 'Finanzen',
      icon: TrendingUp,
      description: 'Umsatz & Statistiken'
    },
    {
      id: 'analytics' as const,
      label: 'Analytics',
      icon: BarChart3,
      description: 'KPIs & Berichte'
    },
    {
      id: 'media' as const,
      label: 'Medien',
      icon: Image,
      description: 'Bilder & Videos'
    },
    {
      id: 'inactive' as const,
      label: 'Inaktive Kunden',
      icon: UserX,
      description: 'Kunden-Reaktivierung'
    },
    {
      id: 'settings' as const,
      label: 'Einstellungen',
      icon: Settings,
      description: 'System & Profil'
    }
  ];

  return (
    <div className="w-80 bg-card border-r flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Scissors className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Vanessa's Salon</h2>
            <p className="text-sm text-muted-foreground">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          return (
            <Button
              key={item.id}
              variant={isActive ? "default" : "ghost"}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full justify-start h-auto p-4 flex-col items-start gap-1",
                isActive && "bg-primary text-primary-foreground"
              )}
            >
              <div className="flex items-center gap-3 w-full">
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </div>
              <span className={cn(
                "text-xs ml-8",
                isActive ? "text-primary-foreground/80" : "text-muted-foreground"
              )}>
                {item.description}
              </span>
            </Button>
          );
        })}
      </nav>

      <Separator />
      
      {/* Footer */}
      <div className="p-4">
        <div className="text-xs text-muted-foreground">
          © 2024 Vanessa's Salon
        </div>
      </div>
    </div>
  );
}