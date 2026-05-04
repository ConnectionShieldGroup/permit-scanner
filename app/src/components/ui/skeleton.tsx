import * as React from 'react';
import { cn } from '../../lib/cn';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-gradient-to-r from-bg-card via-bg-secondary to-bg-card bg-[length:200%_100%]',
        className,
      )}
      {...props}
    />
  );
}
