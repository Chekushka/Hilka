/**
 * One plant of the garden at one of its five stages (lib/meta/garden.ts), in
 * one of eight kinds (`plantSpecies`) so a garden of finished topics is a bed
 * of different flowers. Up to the bud every kind grows the same way — only the
 * bud's colour and, for the slender kinds, the leaves give it away — and the
 * kind shows fully when the topic flowers.
 * Flat inline SVG coloured only through design tokens — nothing to load and
 * no animation, which weak classroom hardware and the brief both ask for.
 * Decorative: the caller always says the stage in words beside it.
 */
import type { ReactNode } from 'react';
import { MAX_PLANT_STAGE, type PlantSpecies, type PlantStage } from '@/lib/meta/garden';

const GROUND_Y = 57;
const CX = 24;

function Leaf({ y, side, size = 1, narrow = false }: { y: number; side: 'left' | 'right'; size?: number; narrow?: boolean }) {
  const dx = (side === 'left' ? -10 : 10) * size * (narrow ? 0.6 : 1);
  const dy = -8 * size * (narrow ? 1.5 : 1);
  return (
    <path
      d={`M${CX} ${y} q ${dx * 0.8} ${dy * 0.25} ${dx} ${dy} q ${-dx * 0.8} 0 ${-dx} ${-dy} z`}
      className="fill-growth"
    />
  );
}

const STEM_TOP: Record<PlantStage, number> = { 0: GROUND_Y, 1: 46, 2: 36, 3: 25, 4: 22 };

/** The petal colour of each kind, also its bud's. Literal class names, so Tailwind sees them. */
const BLOOM: Record<PlantSpecies, string> = {
  daisy: 'fill-honey',
  tulip: 'fill-bloom-rose',
  sunflower: 'fill-honey',
  lavender: 'fill-bloom-violet',
  cornflower: 'fill-bloom-sky',
  bluebell: 'fill-bloom-violet',
  rose: 'fill-bloom-rose',
  clematis: 'fill-bloom-sky'
};

const NARROW_LEAVES: ReadonlySet<PlantSpecies> = new Set(['tulip', 'lavender']);

/** `count` petals of the same shape around (CX, cy), each drawn pointing up and turned into place. */
function Ring({ count, cy, children }: { count: number; cy: number; children: (angle: number) => ReactNode }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const angle = (360 / count) * index;
        return (
          <g key={angle} transform={`rotate(${angle} ${CX} ${cy})`}>
            {children(angle)}
          </g>
        );
      })}
    </>
  );
}

/** The open flower on a stem ending at `top`. */
function Bloom({ species, top }: { species: PlantSpecies; top: number }) {
  const fill = BLOOM[species];
  const cy = top - 6;
  switch (species) {
    case 'tulip':
      return (
        <path
          d={`M${CX - 7} ${cy - 7} L${CX - 3.5} ${cy - 3} L${CX} ${cy - 8} L${CX + 3.5} ${cy - 3} L${CX + 7} ${cy - 7} Q${CX + 7} ${top} ${CX} ${top} Q${CX - 7} ${top} ${CX - 7} ${cy - 7} z`}
          className={fill}
        />
      );
    case 'sunflower':
      return (
        <g className={fill}>
          <Ring count={12} cy={cy}>
            {() => <ellipse cx={CX} cy={cy - 7} rx="2.2" ry="4" />}
          </Ring>
          <circle cx={CX} cy={cy} r="4.5" className="fill-bloom-core" />
        </g>
      );
    case 'lavender':
      // A spike of small flowers continuing the stem upwards.
      return (
        <g className={fill}>
          <line x1={CX} y1={top} x2={CX} y2={top - 17} strokeWidth="1.5" strokeLinecap="round" className="stroke-growth" />
          {[0, 1, 2, 3, 4, 5].map((step) => (
            <ellipse
              key={step}
              cx={CX + (step % 2 === 0 ? -2 : 2)}
              cy={top - 2 - step * 3.2}
              rx={3.4 - step * 0.25}
              ry={2.5 - step * 0.15}
            />
          ))}
        </g>
      );
    case 'cornflower':
      return (
        <g className={fill}>
          <Ring count={8} cy={cy}>
            {() => <path d={`M${CX} ${cy} L${CX - 2.4} ${cy - 7.5} L${CX} ${cy - 6.3} L${CX + 2.4} ${cy - 7.5} z`} />}
          </Ring>
          <circle cx={CX} cy={cy} r="2.5" className="fill-bloom-violet" />
        </g>
      );
    case 'bluebell': {
      // The stem arches over and three bells hang from it.
      const bell = (x: number, y: number) =>
        `M${x - 3.6} ${y + 5} Q${x - 3.6} ${y - 1} ${x} ${y - 1} Q${x + 3.6} ${y - 1} ${x + 3.6} ${y + 5} L${x + 4.6} ${y + 6.5} L${x - 4.6} ${y + 6.5} z`;
      return (
        <>
          <path
            d={`M${CX} ${top} Q${CX + 1} ${top - 15} ${CX + 12} ${top - 12}`}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            className="stroke-growth"
          />
          <g className={fill}>
            <path d={bell(CX + 1, top - 9)} />
            <path d={bell(CX + 7, top - 12)} />
            <path d={bell(CX + 12.5, top - 10)} />
          </g>
        </>
      );
    }
    case 'rose':
      return (
        <g>
          <circle cx={CX} cy={cy} r="7" className={fill} />
          <path
            d={`M${CX - 4} ${cy + 1} Q${CX} ${cy + 5} ${CX + 4} ${cy + 1} M${CX - 2.5} ${cy - 1} Q${CX + 1} ${cy + 2} ${CX + 2.5} ${cy - 2} Q${CX} ${cy - 4} ${CX - 1.5} ${cy - 1.5}`}
            fill="none"
            strokeWidth="1.1"
            strokeLinecap="round"
            className="stroke-surface"
          />
        </g>
      );
    case 'clematis':
      return (
        <g className={fill}>
          <Ring count={4} cy={cy}>
            {() => <path d={`M${CX} ${cy} Q${CX - 4.5} ${cy - 4} ${CX} ${cy - 9} Q${CX + 4.5} ${cy - 4} ${CX} ${cy} z`} />}
          </Ring>
          <g transform={`rotate(45 ${CX} ${cy})`}>
            <Ring count={4} cy={cy}>
              {() => <path d={`M${CX} ${cy} Q${CX - 3} ${cy - 3} ${CX} ${cy - 6} Q${CX + 3} ${cy - 3} ${CX} ${cy} z`} />}
            </Ring>
          </g>
          <circle cx={CX} cy={cy} r="2.2" className="fill-honey" />
        </g>
      );
    case 'daisy':
    default:
      return (
        <g className={fill}>
          {[0, 72, 144, 216, 288].map((angle) => (
            <circle
              key={angle}
              cx={CX + 6 * Math.sin((angle * Math.PI) / 180)}
              cy={cy - 6 * Math.cos((angle * Math.PI) / 180)}
              r="4.5"
            />
          ))}
          <circle cx={CX} cy={cy} r="3" className="fill-soil" />
        </g>
      );
  }
}

export function Plant({
  stage,
  species = 'daisy',
  size = 48
}: {
  stage: PlantStage;
  species?: PlantSpecies;
  size?: number;
}) {
  const stemTop = STEM_TOP[stage];
  const narrow = NARROW_LEAVES.has(species);
  return (
    <svg
      viewBox="0 0 48 64"
      width={size}
      height={(size * 64) / 48}
      aria-hidden="true"
      focusable="false"
      data-stage={stage}
      data-species={species}
    >
      <ellipse cx={CX} cy={GROUND_Y + 2} rx="18" ry="5" className="fill-soil" />
      {stage === 0 && <ellipse cx={CX} cy={GROUND_Y - 1} rx="3.5" ry="2.5" className="fill-growth" />}
      {stage > 0 && (
        <line
          x1={CX}
          y1={GROUND_Y}
          x2={CX}
          y2={stemTop}
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-growth"
        />
      )}
      {stage === 1 && (
        <>
          <Leaf y={48} side="left" size={0.7} narrow={narrow} />
          <Leaf y={48} side="right" size={0.7} narrow={narrow} />
        </>
      )}
      {stage >= 2 && (
        <>
          <Leaf y={50} side="left" narrow={narrow} />
          <Leaf y={46} side="right" narrow={narrow} />
          <Leaf y={40} side="left" size={0.8} narrow={narrow} />
        </>
      )}
      {stage >= 3 && <Leaf y={34} side="right" size={0.8} narrow={narrow} />}
      {stage === 3 && <ellipse cx={CX} cy={stemTop - 2} rx="3.5" ry="5" className={BLOOM[species]} />}
      {stage === MAX_PLANT_STAGE && <Bloom species={species} top={stemTop} />}
    </svg>
  );
}
