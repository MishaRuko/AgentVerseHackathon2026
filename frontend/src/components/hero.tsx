export const Hero = () => {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-24 text-center sm:py-32">
      <span className="inline-flex items-center gap-2 rounded-full border border-black/[.08] bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-white/[.12] dark:bg-zinc-900 dark:text-zinc-400">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Hackathon 2026 · work in progress
      </span>
      <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight text-black sm:text-6xl dark:text-white">
        Build something great at{' '}
        <span className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 bg-clip-text text-transparent">
          AgentVerse
        </span>
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        A Next.js frontend wired to a Dockerized backend. This is the scaffolded
        starting point — edit the components and make it yours.
      </p>
      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a
          href="#features"
          className="flex h-11 w-full items-center justify-center rounded-full bg-black px-6 font-medium text-white transition-colors hover:bg-zinc-800 sm:w-auto dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Explore
        </a>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 w-full items-center justify-center rounded-full border border-black/[.1] px-6 font-medium transition-colors hover:bg-black/[.04] sm:w-auto dark:border-white/[.16] dark:hover:bg-white/[.06]"
        >
          View repo
        </a>
      </div>
    </section>
  );
};
