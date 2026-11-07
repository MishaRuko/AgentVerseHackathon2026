import { Header } from '@/components/header';
import { Hero } from '@/components/hero';
import { FeatureGrid } from '@/components/feature-grid';
import { BackendStatus } from '@/components/backend-status';
import { Footer } from '@/components/footer';

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <FeatureGrid />
        <section className="mx-auto w-full max-w-5xl px-6 pb-20">
          <BackendStatus />
        </section>
      </main>
      <Footer />
    </>
  );
}
