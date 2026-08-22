import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@fontsource-variable/instrument-sans';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/ibm-plex-mono/400.css';

import { SiteHeader } from '@/components/site-header';
import { getSession } from '@/server/auth/session';

import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  description: 'Weekly simulated trading competitions',
  title: 'Profitopath',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await getSession();
  return (
    <html lang="en">
      <body>
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
            <span>Profitopath / simulated competition ledger</span>
            <span>Fictitious capital · no live brokerage execution</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
