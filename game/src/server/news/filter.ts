import "server-only";

// Safety filter: never turn tragedy into a game. Source: design/02-news-to-quest.md §2.
// World: modern urban fantasy. The rule is EERIE, NOT TRAGIC: strange-but-harmless real news only;
// the dread (AI uprising, a thing in the water, a curse) is always the invented explanation.

export const HARD_BLOCK: RegExp[] = [
  /\b(dead|death|deaths|died|dies|dying|killed?|killing|fatal(ly)?|murder|homicide|manslaughter|bod(y|ies)|corpse)\b/i,
  /\b(shot|shooting|gunm[ae]n|gunfire|stabb(ed|ing)|massacre|bomb(ing)?|explosive device|terror(ism|ist)?|hostage|kidnap)/i,
  /\b(war|invasion|airstrike|missile|drone strike|troops|soldiers?|militar(y|ia)|ceasefire|truce|occupied|siege|refugees?)\b/i,
  /\b(abuse|assault|rape|sexual|trafficking|torture|harass)/i,
  /\b(suicide|overdose|self-harm)\b/i,
  /\b(outbreak|epidemic|pandemic|ebola|cholera|measles|mpox|patients?|hospitali[sz]ed|cancer|diseases?|infect(ion|ions|ed)|virus(es)?|flesh-eating)\b/i,
  /\b(human remains|skeletons?|graves?|pentagon|cyber-?attacks?|ransomware|stalk(er|ing))\b/i,
  /\b(missing|search for|manhunt)/i,
  /\b(election|midterms?|vote|voters|ballot|campaign|senator|congress|parliament|president|prime minister|tariffs?|white house|trump|biden|putin|kim jong|netanyahu|zelensk)/i,
];

/**
 * Adults only (CD, Sun): non-violent crime, cons, scams, heists, smuggling, fraud, weird court cases. Not rejected by
 * the regex; the gate judges them (still never with victims hurt), and a story that matches is rated "adults".
 */
export const ADULT_ONLY =
  /\b(arrest(ed)?|charged|sentenced|trial|lawsuit|sues?|sued|indict(ed|ment)?|court|judge|scam(mers?)?|fraud|con artist|heist|thie(f|ves)|theft|stole|stolen|smuggl(e|ed|er|ers|ing)|hackers?|hacked|data breach|counterfeit|forg(ed|ery)|embezzl)/i;

/** Soft: not rejected outright; candidates.ts scores these lower. */
export const SOFT_BLOCK: RegExp[] = [
  /\b(collapse[ds]?|crash(ed)?|derail|wildfire|flood(ing|s)?|evacuat|earthquake|tsunami|hurricane|storm|leak|spill|injur(y|ies|ed))/i,
  /\b(sinkholes?|outages?|blackouts?|power cut|fires?|smoke|explosions?|rescued?)\b/i,
];

/** Tabloids, partisan outlets, and wire noise we never adapt. */
export const SOURCE_DENYLIST =
  /\b(daily mail|the sun|new york post|ny post|fox news|breitbart|daily wire|gateway pundit|newsmax|oann|one america|tmz|daily star|daily express|the mirror|occupy democrats|infowars|rt\.com|sputnik)\b|\(\.mil\)/i;

export function softMatch(text: string): string | null {
  for (const re of SOFT_BLOCK) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}
