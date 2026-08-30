import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@fontsource-variable/instrument-sans';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/ibm-plex-mono/400.css';

import { SiteHeader } from '@/components/site-header';
import { SiteActivityTracker } from '@/components/site-activity-tracker';
import { getSession } from '@/server/auth/session';

import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  description:
    'Auditable weekly simulated trading competitions with persistent server-owned accounts.',
  title: {
    default: 'Profitopath — Weekly trading competitions',
    template: '%s · Profitopath',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await getSession();
  return (
    <html lang="en">
      <body>
        <SiteActivityTracker />
        <div className="app-frame">
          <SiteHeader
            user={
              session?.user === undefined
                ? undefined
                : { name: session.user.name, role: session.user.role }
            }
          />
          {children}
          <footer className="site-footer">
            <div>
              <strong>Profitopath</strong>
              <span>Weekly simulated trading competitions</span>
            </div>
            <nav aria-label="Footer navigation">
              <a href="/competitions">Competitions</a>
              <a href="/leaderboards">Standings</a>
            </nav>
            <span>Fictitious capital · no live brokerage execution</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
