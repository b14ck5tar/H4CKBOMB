import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-full flex items-center justify-center px-4 py-8 sm:p-8">
      <div className="page max-w-2xl w-full p-6 sm:p-12 flex flex-col gap-6 fade-in">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="on-air">Live</span>
          <p className="kicker">HackTX ’26 · Once Upon a Hack</p>
        </div>

        <h1 className="sr-only">Group Project</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-group-project.jpg" alt="Group Project" className="w-full h-auto rounded-xl" />

        <div className="gilt-rule" />

        <p className="font-heading font-bold uppercase text-2xl sm:text-3xl leading-tight tracking-wide">
          Nobody has to be the <span className="text-crimson">Dungeon Master</span> anymore.
        </p>
        <p className="text-lg sm:text-xl leading-relaxed text-ink-soft">
          Open the table on a laptop or TV. Everyone joins on their phone and makes a hero. Muse, Meta’s AI, runs a story
          that starts from this week’s odd real news or from something that really happened to one of you.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 pt-1">
          <Link href="/tv" className="btn btn-crimson text-xl">Open the table</Link>
          <Link href="/play" className="btn btn-gilt text-xl">Join on my phone</Link>
        </div>

        <p className="font-ui text-xs uppercase tracking-[0.2em] text-ink-soft/80 border-t border-white/10 pt-4">
          Case file 26-GP · Source: <span className="redacted">today’s headlines</span> · Status: open
        </p>
      </div>
    </main>
  );
}
