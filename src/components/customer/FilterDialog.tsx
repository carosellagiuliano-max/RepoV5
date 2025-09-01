import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface FilterDialogProps {
  type: 'appointments' | 'products' | 'history';
}

const FilterDialog = ({ type }: FilterDialogProps) => {
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [status, setStatus] = useState('');
  const [service, setService] = useState('');
  const [stylist, setStylist] = useState('');

  const getFilterTitle = () => {
    switch (type) {
      case 'appointments':
        return 'Termine filtern';
      case 'products':
        return 'Produkte filtern';
      case 'history':
        return 'Verlauf filtern';
      default:
        return 'Filter';
    }
  };

  const handleApplyFilters = () => {
    console.log('Applying filters:', {
      type,
      dateFrom,
      dateTo,
      status,
      service,
      stylist
    });
  };

  const resetFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setStatus('');
    setService('');
    setStylist('');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading text-primary">
            {getFilterTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Zeitraum</Label>
            <div className="flex space-x-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd.MM.yyyy") : "Von Datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd.MM.yyyy") : "Bis Datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Status Filter */}
          {type === 'appointments' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Status</SelectItem>
                  <SelectItem value="geplant">Geplant</SelectItem>
                  <SelectItem value="abgeschlossen">Abgeschlossen</SelectItem>
                  <SelectItem value="storniert">Storniert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Service Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {type === 'products' ? 'Produktkategorie' : 'Service'}
            </Label>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger>
                <SelectValue placeholder={type === 'products' ? 'Kategorie auswählen' : 'Service auswählen'} />
              </SelectTrigger>
              <SelectContent>
                {type === 'products' ? (
                  <>
                    <SelectItem value="alle">Alle Kategorien</SelectItem>
                    <SelectItem value="haarpflege">Haarpflege</SelectItem>
                    <SelectItem value="styling">Styling</SelectItem>
                    <SelectItem value="zubehoer">Zubehör</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="alle">Alle Services</SelectItem>
                    <SelectItem value="haarschnitt">Haarschnitt</SelectItem>
                    <SelectItem value="faerbung">Färbung</SelectItem>
                    <SelectItem value="styling">Styling</SelectItem>
                    <SelectItem value="behandlung">Behandlung</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Stylist Filter */}
          {type !== 'products' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Stylist</Label>
              <Select value={stylist} onValueChange={setStylist}>
                <SelectTrigger>
                  <SelectValue placeholder="Stylist auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Stylisten</SelectItem>
                  <SelectItem value="vanessa">Vanessa (Inhaberin)</SelectItem>
                  <SelectItem value="maria">Maria</SelectItem>
                  <SelectItem value="sarah">Sarah</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Price Range for Products */}
          {type === 'products' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Preisbereich</Label>
              <div className="flex space-x-2">
                <Input placeholder="Von €" type="number" />
                <Input placeholder="Bis €" type="number" />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-4">
            <Button onClick={handleApplyFilters} className="flex-1">
              Filter anwenden
            </Button>
            <Button variant="outline" onClick={resetFilters}>
              Zurücksetzen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FilterDialog;