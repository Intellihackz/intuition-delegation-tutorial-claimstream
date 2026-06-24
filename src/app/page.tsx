import { ConnectButton } from '@/components/ConnectButton';
import { ClaimFeed } from '@/components/ClaimFeed';
import { CreateClaimForm } from '@/components/CreateClaimForm';
import { UpgradeAccount } from '@/components/UpgradeAccount';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white py-16 px-4 sm:px-6 lg:px-8 selection:bg-white selection:text-black font-sans">
      <div className="max-w-3xl mx-auto">
        <header className="flex justify-between items-start mb-16 border-b border-white/10 pb-8">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase">
              Intuition<br/><span className="text-white/50">Claim Feed</span>
            </h1>
            <p className="text-white/60 mt-4 text-sm uppercase tracking-widest font-semibold">Make claims. Support truth. Oppose falsehood.</p>
          </div>
          <ConnectButton />
        </header>

        <UpgradeAccount />
        <CreateClaimForm />
        
        <div className="mt-20">
          <h2 className="text-sm font-bold text-white/50 mb-8 uppercase tracking-widest border-b border-white/10 pb-4">Activity Feed</h2>
          <ClaimFeed />
        </div>
      </div>
    </main>
  );
}
