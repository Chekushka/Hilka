/**
 * The practice character (lib/meta/character.ts) in the look it wears: a
 * small round sprout-creature — hilka is a branch — that the student dresses
 * with what their XP unlocked. Flat inline SVG coloured only through design
 * tokens, no images and no animation, like the garden's plants. Neutral on
 * purpose: no gender, no age, nothing a 15-year-old would read as babyish.
 * Decorative: whoever shows it also says the level in words.
 */
import type { ReactNode } from 'react';
import type { CharacterLook } from '@/lib/meta/character';

const BODY_FILL: Record<string, string> = {
  leaf: 'var(--growth)',
  sky: 'var(--bloom-sky)',
  honey: 'var(--honey)',
  rose: 'var(--bloom-rose)',
  violet: 'var(--bloom-violet)',
  night: 'var(--char-night)'
};

const EYE = 'var(--char-eye)';
const GLINT = 'var(--char-glint)';
const SHADE = 'var(--char-shade)';

const EYE_X = [49, 71] as const;
const EYE_Y = 62;

function Eyes({ kind }: { kind: string }) {
  switch (kind) {
    case 'happy':
      return (
        <g fill="none" stroke={EYE} strokeWidth="3" strokeLinecap="round">
          {EYE_X.map((x) => (
            <path key={x} d={`M${x - 5} ${EYE_Y + 2} q5 -7 10 0`} />
          ))}
        </g>
      );
    case 'glasses':
      return (
        <g>
          <DotEyes />
          <g fill={GLINT} fillOpacity="0.25" stroke={EYE} strokeWidth="2.5">
            {EYE_X.map((x) => (
              <circle key={x} cx={x} cy={EYE_Y} r="8.5" />
            ))}
          </g>
          <path d={`M${EYE_X[0] + 8.5} ${EYE_Y} h${EYE_X[1] - EYE_X[0] - 17}`} stroke={EYE} strokeWidth="2.5" />
        </g>
      );
    case 'shades':
      return (
        <g>
          {EYE_X.map((x) => (
            <rect key={x} x={x - 10} y={EYE_Y - 6} width="20" height="12" rx="4" fill={EYE} />
          ))}
          <path d={`M${EYE_X[0] + 10} ${EYE_Y - 3} h${EYE_X[1] - EYE_X[0] - 20}`} stroke={EYE} strokeWidth="3" />
          {EYE_X.map((x) => (
            <path key={x} d={`M${x - 6} ${EYE_Y - 1} l4 -3`} stroke={GLINT} strokeWidth="1.8" strokeLinecap="round" />
          ))}
        </g>
      );
    case 'stars':
      return (
        <g fill="var(--honey)" stroke={EYE} strokeWidth="1.5" strokeLinejoin="round">
          {EYE_X.map((x) => (
            <path key={x} d={star(x, EYE_Y, 7, 3)} />
          ))}
        </g>
      );
    default:
      return <DotEyes />;
  }
}

function DotEyes() {
  return (
    <g>
      {EYE_X.map((x) => (
        <g key={x}>
          <circle cx={x} cy={EYE_Y} r="4.5" fill={EYE} />
          <circle cx={x + 1.5} cy={EYE_Y - 1.6} r="1.4" fill={GLINT} />
        </g>
      ))}
    </g>
  );
}

/** A five-pointed star centred on (cx, cy). */
function star(cx: number, cy: number, outer: number, inner: number): string {
  const points = Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * index - Math.PI / 2;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${points.join(' L')} Z`;
}

function Head({ kind }: { kind: string }) {
  switch (kind) {
    case 'sprout':
      return (
        <g fill="var(--accent)">
          <path d="M60 40 V25" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
          <path d="M60 28 q-13 -1 -16 -13 q13 0 16 13 z" />
          <path d="M60 31 q10 -2 13 -11 q-10 0 -13 11 z" />
        </g>
      );
    case 'cap':
      return (
        <g>
          <path d="M33 47 q27 -30 54 0 z" fill="var(--accent)" />
          <path d="M60 44 h30 q6 0 6 4 h-36 z" fill="var(--accent)" />
          <path d="M60 44 h30 q6 0 6 4 h-36 z" fill={SHADE} />
          <circle cx="60" cy="25" r="2.5" fill="var(--accent)" />
        </g>
      );
    case 'beanie':
      return (
        <g>
          <path d="M33 49 q27 -32 54 0 z" fill="var(--bloom-rose)" />
          <rect x="31" y="43" width="58" height="9" rx="4.5" fill="var(--bloom-rose)" />
          <rect x="31" y="43" width="58" height="9" rx="4.5" fill={SHADE} />
          <circle cx="60" cy="20" r="5.5" fill="var(--honey)" />
        </g>
      );
    case 'headphones':
      return (
        <g>
          <path d="M29 62 q0 -40 31 -40 q31 0 31 40" fill="none" stroke={EYE} strokeWidth="4.5" strokeLinecap="round" />
          <rect x="22" y="54" width="11" height="19" rx="4.5" fill={EYE} />
          <rect x="87" y="54" width="11" height="19" rx="4.5" fill={EYE} />
          <rect x="24.5" y="57" width="3" height="13" rx="1.5" fill="var(--bloom-sky)" />
          <rect x="92.5" y="57" width="3" height="13" rx="1.5" fill="var(--bloom-sky)" />
        </g>
      );
    case 'flower':
      return (
        <g>
          <g fill="var(--bloom-rose)">
            {[0, 72, 144, 216, 288].map((angle) => (
              <ellipse key={angle} cx="78" cy="31" rx="4" ry="6" transform={`rotate(${angle} 78 37)`} />
            ))}
          </g>
          <circle cx="78" cy="37" r="3.8" fill="var(--honey)" />
        </g>
      );
    case 'crown':
      return (
        <g>
          <path
            d="M39 43 L42 22 L51 32 L60 17 L69 32 L78 22 L81 43 Z"
            fill="var(--honey)"
            stroke="var(--honey-ink)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="60" cy="34" r="3" fill="var(--bloom-rose)" />
          <circle cx="48" cy="37" r="2" fill="var(--bloom-sky)" />
          <circle cx="72" cy="37" r="2" fill="var(--bloom-sky)" />
        </g>
      );
    default:
      return null;
  }
}

/** What the character wears or carries in front of its body. */
function Extra({ kind }: { kind: string }): ReactNode {
  switch (kind) {
    case 'scarf':
      return (
        <g>
          <path d="M30 76 q30 11 60 0 v9 q-30 11 -60 0 z" fill="var(--bloom-sky)" />
          <rect x="66" y="84" width="10" height="18" rx="3" fill="var(--bloom-sky)" />
          <rect x="66" y="84" width="10" height="18" rx="3" fill={SHADE} />
        </g>
      );
    case 'book':
      return (
        <g>
          <rect x="43" y="80" width="34" height="23" rx="2.5" fill="var(--bloom-violet)" />
          <rect x="43" y="80" width="5" height="23" rx="2" fill={SHADE} />
          <path d="M53 88 h18 M53 93 h13" stroke={GLINT} strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case 'laptop':
      return (
        <g>
          <rect x="41" y="78" width="38" height="24" rx="2.5" fill={EYE} />
          <path d="M47 86 l4 3 l-4 3 M54 93 h7" fill="none" stroke="var(--growth)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M36 102 h48 l-3 4 h-42 z" fill={EYE} />
        </g>
      );
    case 'python':
      return (
        <g>
          <path
            d="M82 109 h15 q8 0 8 -7 q0 -7 -7 -7 q-7 0 -7 -7 q0 -8 8 -8"
            fill="none"
            stroke="var(--bloom-sky)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <ellipse cx="101" cy="80" rx="6.5" ry="5" fill="var(--bloom-sky)" />
          <circle cx="103" cy="78.5" r="1.4" fill={EYE} />
          <path d="M107 81 l4 1 m-4 -1 l4 -1.5" stroke="var(--bloom-rose)" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="94" cy="99" r="1.6" fill="var(--honey)" />
          <circle cx="97" cy="90" r="1.6" fill="var(--honey)" />
        </g>
      );
    default:
      return null;
  }
}

export function Character({ look, size = 96 }: { look: CharacterLook; size?: number }) {
  const body = BODY_FILL[look.body] ?? BODY_FILL.leaf;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className="flex-none"
      data-look={`${look.body} ${look.eyes} ${look.head} ${look.extra}`}
    >
      <ellipse cx="60" cy="110" rx="32" ry="4" fill={SHADE} />
      {/* Feet and arms take the body's colour, a shade darker. */}
      <g fill={body}>
        <ellipse cx="47" cy="104" rx="9" ry="5.5" />
        <ellipse cx="73" cy="104" rx="9" ry="5.5" />
        <ellipse cx="27" cy="76" rx="6" ry="10" transform="rotate(20 27 76)" />
        <ellipse cx="93" cy="76" rx="6" ry="10" transform="rotate(-20 93 76)" />
      </g>
      <g fill={SHADE}>
        <ellipse cx="47" cy="104" rx="9" ry="5.5" />
        <ellipse cx="73" cy="104" rx="9" ry="5.5" />
        <ellipse cx="27" cy="76" rx="6" ry="10" transform="rotate(20 27 76)" />
        <ellipse cx="93" cy="76" rx="6" ry="10" transform="rotate(-20 93 76)" />
      </g>
      <rect x="28" y="38" width="64" height="68" rx="31" fill={body} />
      <ellipse cx="60" cy="86" rx="20" ry="14" fill={GLINT} fillOpacity="0.28" />
      <ellipse cx="41" cy="72" rx="4.5" ry="2.6" fill="var(--bloom-rose)" fillOpacity="0.55" />
      <ellipse cx="79" cy="72" rx="4.5" ry="2.6" fill="var(--bloom-rose)" fillOpacity="0.55" />
      <Eyes kind={look.eyes} />
      <path d="M54 73 q6 5 12 0" fill="none" stroke={EYE} strokeWidth="2.5" strokeLinecap="round" />
      <Extra kind={look.extra} />
      <Head kind={look.head} />
    </svg>
  );
}
