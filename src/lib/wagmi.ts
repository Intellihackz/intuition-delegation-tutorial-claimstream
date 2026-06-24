import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { intuitionTestnet } from './chains';

export const wagmiConfig = createConfig({
  chains: [intuitionTestnet],
  connectors: [injected({ target: 'metaMask' })],
  transports: {
    [intuitionTestnet.id]: http(),
  },
});
