interface Feature {
  title: string;
  description: string;
  icon: string;
}

const FEATURES: Feature[] = [
  {
    title: 'Next.js 16 + App Router',
    description: 'React Server Components, TypeScript strict mode, and fast refresh out of the box.',
    icon: '▲',
  },
  {
    title: 'Tailwind CSS v4',
    description: 'Utility-first styling with the new CSS-first config. No JS theme file to babysit.',
    icon: '🎨',
  },
  {
    title: 'Decoupled backend',
    description: 'Talks to a Dockerized service over HTTP through one typed API client. Swappable by design.',
    icon: '🔌',
  },
];

const FeatureCard = ({ title, description, icon }: Feature) => {
  return (
    <div className="rounded-2xl border border-black/[.08] bg-white p-6 transition-shadow hover:shadow-md dark:border-white/[.12] dark:bg-zinc-950">
      <div
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-lg dark:bg-zinc-900"
      >
        {icon}
      </div>
      <h3 className="mt-4 font-semibold tracking-tight text-black dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{description}</p>
    </div>
  );
};

export const FeatureGrid = () => {
  return (
    <section id="features" className="mx-auto w-full max-w-5xl scroll-mt-20 px-6 py-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  );
};
