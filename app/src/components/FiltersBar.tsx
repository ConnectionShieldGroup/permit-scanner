import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Label } from './ui/label';
import {
  ACTIVE_CITIES,
  WORK_TYPE_LABELS,
  type PermitFilters,
  type WorkType,
} from '../lib/types';

interface FiltersBarProps {
  filters: PermitFilters;
  searchQuery: string;
  onFiltersChange: (f: PermitFilters) => void;
  onSearchChange: (q: string) => void;
  resultCount?: number;
}

const WORK_TYPES: WorkType[] = [
  'new_construction',
  'kitchen_renovation',
  'bath_renovation',
  'addition',
  'renovation',
  'building_permit',
  'foundation_permit',
];

export function FiltersBar({
  filters,
  searchQuery,
  onFiltersChange,
  onSearchChange,
  resultCount,
}: FiltersBarProps) {
  const [month, setMonth] = useState<string>('');

  const hasActiveFilters =
    !!filters.city || !!filters.work_type || !!filters.month_start || !!searchQuery.trim();

  const clearAll = () => {
    onFiltersChange({});
    onSearchChange('');
    setMonth('');
  };

  function applyMonth(value: string) {
    setMonth(value);
    if (!value) {
      const { month_start, month_end, ...rest } = filters;
      void month_start;
      void month_end;
      onFiltersChange(rest);
      return;
    }
    const [year, m] = value.split('-').map(Number);
    const start = new Date(year, m - 1, 1).toISOString();
    const end = new Date(year, m, 0, 23, 59, 59).toISOString();
    onFiltersChange({ ...filters, month_start: start, month_end: end });
  }

  return (
    <div className="rounded-2xl border border-border bg-bg-card/40 backdrop-blur p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <SlidersHorizontal className="h-4 w-4 text-gold-400" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Filters
        </h2>
        {typeof resultCount === 'number' && (
          <span className="ml-auto text-xs mono text-text-muted">
            {resultCount} {resultCount === 1 ? 'permit' : 'permits'}
          </span>
        )}
        {hasActiveFilters && (
          <Button
            size="sm"
            variant="ghost"
            onClick={clearAll}
            className="h-7 px-2 text-xs"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-12">
        <div className="md:col-span-5 space-y-1.5">
          <Label htmlFor="search">Search address</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              id="search"
              placeholder="2 Aberdeen Road..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>

        <div className="md:col-span-3 space-y-1.5">
          <Label>City</Label>
          <Select
            value={filters.city ?? '__all__'}
            onValueChange={(v) =>
              onFiltersChange({
                ...filters,
                city: v === '__all__' ? undefined : v,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All cities ({ACTIVE_CITIES.length})</SelectItem>
              {ACTIVE_CITIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}, MA
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <Label htmlFor="month">Month</Label>
          <Input
            id="month"
            type="month"
            value={month}
            onChange={(e) => applyMonth(e.target.value)}
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <Label>Work type</Label>
          <Select
            value={filters.work_type ?? '__all__'}
            onValueChange={(v) =>
              onFiltersChange({
                ...filters,
                work_type: v === '__all__' ? undefined : (v as WorkType),
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All types</SelectItem>
              {WORK_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {WORK_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
