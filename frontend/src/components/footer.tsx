export const Footer = () => {
  return (
    <footer className="border-t border-black/[.08] dark:border-white/[.12]">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-2 px-6 py-8 text-sm text-zinc-500 sm:flex-row">
        <p>AgentVerse Hackathon 2026</p>
        <p>
          Built with{' '}
          <a
            href="https://nextjs.org"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white"
          >
            Next.js
          </a>
        </p>
      </div>
    </footer>
  );
};
