'use client';

import { useEffect } from 'react';

/** CLI-01: once the page has its one-time token, the token leaves the address bar (history, screenshots, sharing). */
export function ForgetQuery() {
  useEffect(() => {
    if (location.search) history.replaceState(history.state, '', location.pathname + location.hash);
  }, []);
  return null;
}
