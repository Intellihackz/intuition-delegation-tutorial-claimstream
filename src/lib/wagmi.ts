import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { intuitionMainnet } from './chains';

export const wagmiConfig = createConfig({
  chains: [intuitionMainnet],
  connectors: [injected({ target: 'metaMask' })],
  transports: {
    [intuitionMainnet.id]: http(),
  },
});
