'use client';

import { useEffect } from 'react';

const heartbeatIntervalMs = 60_000;

function reportActivity(): void {
  if (document.visibilityState !== 'visible') {
    return;
  }

  void fetch('/api/site-activity', {
    body: JSON.stringify({ path: window.location.pathname }),
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  }).catch(() => undefined);
}

export function SiteActivityTracker() {
  useEffect(() => {
    reportActivity();
    const interval = window.setInterval(reportActivity, heartbeatIntervalMs);
    window.addEventListener('focus', reportActivity);
    document.addEventListener('visibilitychange', reportActivity);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', reportActivity);
      document.removeEventListener('visibilitychange', reportActivity);
    };
  }, []);

  return null;
}
