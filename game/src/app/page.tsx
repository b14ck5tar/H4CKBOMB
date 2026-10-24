import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-full flex items-center justify-center p-5">
      <div className="page max-w-xl w-full p-8 sm:p-10 text-center flex flex-col gap-6 fade-in">
        <p className="font-ui uppercase tracking-[0.25em] text-sm text-ink-soft">HackTX ’26 · Once Upon a Hack</p>
        <h1 className="font-display text-4xl sm:text-5xl leading-tight">Once Upon a Roll</h1>
        <div className="gilt-rule" />
        <p className="text-xl italic text-ink-soft">Nobody has to be the Dungeon Master anymore.</p>
        <p className="text-lg">
          Open the table on a laptop or TV. Everyone joins on their phone, describes a hero in one line, and the AI Dungeon Master
          spins a fairytale quest out of today’s real news.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/tv" className="btn btn-crimson text-lg">Open the table</Link>
          <Link href="/play" className="btn btn-gilt text-lg">Join on my phone</Link>
        </div>
      </div>
    </main>
  );
}
