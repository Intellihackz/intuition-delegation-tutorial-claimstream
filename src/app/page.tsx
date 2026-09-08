import { ConnectButton } from '@/components/ConnectButton';
import { AppShell } from '@/components/AppShell';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white py-16 px-4 sm:px-6 lg:px-8 selection:bg-white selection:text-black font-sans">
      <div className="max-w-3xl mx-auto">
        <header className="flex justify-between items-start mb-16 border-b border-white/10 pb-8">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase">
              Intuition<br/><span className="text-white/50">Claim Feed</span>
            </h1>
            <p className="text-white/60 mt-4 text-sm uppercase tracking-widest font-semibold">Browse claims. Support truth. Oppose falsehood.</p>
          </div>
          <ConnectButton />
        </header>

        <AppShell />
      </div>
    </main>
  );
}
