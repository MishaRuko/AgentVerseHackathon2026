import Link from 'next/link';

export const Header = () => {
  return (
    <header className="sticky top-0 z-10 border-b border-black/[.08] bg-white/80 backdrop-blur dark:border-white/[.12] dark:bg-black/60">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-bold text-white"
          >
            A
          </span>
          AgentVerse
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-6 text-sm">
          <a className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white" href="#features">
            Features
          </a>
          <a className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white" href="#status">
            Status
          </a>
          <a
            className="rounded-full bg-black px-4 py-1.5 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Docs
          </a>
        </nav>
      </div>
    </header>
  );
};
