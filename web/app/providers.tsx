"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { restoreSession } from "@/lib/api";

export function Providers({ children }: { children: React.ReactNode }) {
  // One client per browser tab; created lazily so server renders don't share it.
  const [queryClient] = useState(() => new QueryClient());

  // The access token lives in memory, so every page load starts by trading the
  // refresh cookie for a new one (decision I4).
  useEffect(() => {
    void restoreSession();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
