import { MapPin, ArrowUpRight } from 'lucide-react';
import { buildRouteUrl, formatAddressForMaps } from '../lib/google-maps';
import type { Permit } from '../lib/types';
import { cn } from '../lib/cn';

interface RouteButtonProps {
  selected: Permit[];
  onClear?: () => void;
}

export function RouteButton({ selected, onClear }: RouteButtonProps) {
  if (selected.length === 0) return null;

  const handleClick = () => {
    const addresses = selected.map((p) =>
      formatAddressForMaps(p.address, p.city, p.state),
    );
    const url = buildRouteUrl(addresses);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-30 animate-fade-in',
        'flex items-center gap-2 rounded-2xl border border-gold-400/40 bg-bg-secondary/95 backdrop-blur-xl',
        'shadow-2xl shadow-black/50',
      )}
    >
      <button
        onClick={handleClick}
        className={cn(
          'flex items-center gap-3 pl-4 pr-3 py-3 text-sm font-semibold transition-colors',
          'text-white hover:text-gold-300',
        )}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold-gradient text-black">
          <MapPin className="h-4 w-4" strokeWidth={2.5} />
        </span>
        <span>
          Build route
          <span className="ml-1.5 mono text-gold-300">({selected.length})</span>
        </span>
        <ArrowUpRight className="h-4 w-4 text-text-secondary" />
      </button>
      {onClear && (
        <button
          onClick={onClear}
          className="px-3 py-3 text-xs text-text-muted hover:text-white border-l border-border transition-colors"
          aria-label="Clear selection"
        >
          Clear
        </button>
      )}
    </div>
  );
}
