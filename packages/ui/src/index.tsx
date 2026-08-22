import type { ReactNode } from 'react';

export interface SurfaceProps {
  children: ReactNode;
}

export function Surface({ children }: SurfaceProps) {
  return <section>{children}</section>;
}
