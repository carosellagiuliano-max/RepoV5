import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, Award, Medal, Gem } from 'lucide-react';

interface CustomerStatusProps {
  totalSpent?: number;
  showProgress?: boolean;
  compact?: boolean;
  hideStatus?: boolean;
  showInProfile?: boolean;
}

const CustomerStatus = ({ totalSpent = 2840, showProgress = true, compact = false, hideStatus = false, showInProfile = false }: CustomerStatusProps) => {
  const statusLevels = [
    { 
      name: 'Bronze', 
      minSpent: 0, 
      maxSpent: 500, 
      icon: Medal, 
      color: 'from-amber-600 to-amber-800',
      bgColor: 'bg-amber-50 border-amber-200',
      textColor: 'text-amber-800',
      badgeColor: 'bg-amber-100 text-amber-800'
    },
    { 
      name: 'Silber', 
      minSpent: 500, 
      maxSpent: 1500, 
      icon: Award, 
      color: 'from-gray-400 to-gray-600',
      bgColor: 'bg-gray-50 border-gray-200',
      textColor: 'text-gray-800',
      badgeColor: 'bg-gray-100 text-gray-800'
    },
    { 
      name: 'Gold', 
      minSpent: 1500, 
      maxSpent: 3000, 
      icon: Crown, 
      color: 'from-yellow-400 to-yellow-600',
      bgColor: 'bg-yellow-50 border-yellow-200',
      textColor: 'text-yellow-800',
      badgeColor: 'bg-yellow-100 text-yellow-800'
    },
    { 
      name: 'Diamant', 
      minSpent: 3000, 
      maxSpent: Infinity, 
      icon: Gem, 
      color: 'from-blue-400 to-purple-600',
      bgColor: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-800',
      badgeColor: 'bg-blue-100 text-blue-800'
    }
  ];

  const getCurrentStatus = () => {
    return statusLevels.find(level => 
      totalSpent >= level.minSpent && totalSpent < level.maxSpent
    ) || statusLevels[0];
  };

  const getNextStatus = () => {
    const currentIndex = statusLevels.findIndex(level => 
      totalSpent >= level.minSpent && totalSpent < level.maxSpent
    );
    return currentIndex < statusLevels.length - 1 ? statusLevels[currentIndex + 1] : null;
  };

  const getProgressToNext = () => {
    const current = getCurrentStatus();
    const next = getNextStatus();
    
    if (!next) return 100;
    
    const progressInCurrentLevel = totalSpent - current.minSpent;
    const totalNeededForNext = next.minSpent - current.minSpent;
    
    return Math.min(100, (progressInCurrentLevel / totalNeededForNext) * 100);
  };

  const currentStatus = getCurrentStatus();
  const nextStatus = getNextStatus();
  const StatusIcon = currentStatus.icon;
  const progress = getProgressToNext();
  const amountToNext = nextStatus ? nextStatus.minSpent - totalSpent : 0;

  // Compact version for header
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`p-1 rounded ${currentStatus.bgColor}`}>
          <StatusIcon className={`h-3 w-3 ${currentStatus.textColor}`} />
        </div>
        {!hideStatus && (
          <span className={`text-xs font-medium ${currentStatus.textColor}`}>
            {currentStatus.name}
          </span>
        )}
      </div>
    );
  }

  if (showInProfile) {
    return (
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${currentStatus.bgColor}`}>
                <StatusIcon className={`h-6 w-6 ${currentStatus.textColor}`} />
              </div>
              <div>
                <h3 className="font-semibold">{currentStatus.name} Status</h3>
              </div>
            </div>
            <Badge className={`${currentStatus.bgColor} ${currentStatus.textColor} border-0`}>
              {currentStatus.name}
            </Badge>
          </div>
          
          {nextStatus && (
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Bis {nextStatus.name}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-primary to-primary/80 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!showProgress) {
    return (
      <Badge className={`${currentStatus.bgColor} ${currentStatus.textColor} border hover:scale-105 transition-transform duration-200`}>
        <StatusIcon className="h-4 w-4 mr-1" />
        {currentStatus.name} Kunde
      </Badge>
    );
  }

  return (
    <Card className={`${currentStatus.bgColor} border-2 hover-scale`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded-full bg-gradient-to-r ${currentStatus.color}`}>
              <StatusIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className={`font-semibold ${currentStatus.textColor}`}>
                {currentStatus.name} Status
              </h3>
            </div>
          </div>
          {nextStatus && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Bis {nextStatus.name}</p>
              <p className="text-sm font-semibold text-primary">
                {Math.round(progress)}%
              </p>
            </div>
          )}
        </div>
        
        {nextStatus && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{currentStatus.name}</span>
              <span>{nextStatus.name}</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              {Math.round(progress)}% bis zum nächsten Status
            </p>
          </div>
        )}
        
        {!nextStatus && (
          <div className="text-center">
            <p className="text-sm font-semibold text-primary">
              🎉 Höchster Status erreicht!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CustomerStatus;