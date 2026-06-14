'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { WalletProvider } from './WalletContext';
import { configureClient } from '@0xintuition/graphql';

// Ensure the SDK is configured before any React components render or query hooks fire
configureClient({ apiUrl: 'https://testnet.intuition.sh/v1/graphql' });

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        {children}
      </WalletProvider>
    </QueryClientProvider>
  );
}
