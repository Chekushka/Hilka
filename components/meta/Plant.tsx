/**
 * One plant of the garden at one of its five stages (lib/meta/garden.ts).
 * Flat inline SVG coloured only through design tokens — nothing to load and
 * no animation, which weak classroom hardware and the brief both ask for.
 * Decorative: the caller always says the stage in words beside it.
 */
import { MAX_PLANT_STAGE, type PlantStage } from '@/lib/meta/garden';

const GROUND_Y = 57;

function Leaf({ y, side, size = 1 }: { y: number; side: 'left' | 'right'; size?: number }) {
  const dx = (side === 'left' ? -10 : 10) * size;
  const dy = -8 * size;
  return (
    <path
      d={`M24 ${y} q ${dx * 0.8} ${dy * 0.25} ${dx} ${dy} q ${-dx * 0.8} 0 ${-dx} ${-dy} z`}
      className="fill-growth"
    />
  );
}

const STEM_TOP: Record<PlantStage, number> = { 0: GROUND_Y, 1: 46, 2: 36, 3: 25, 4: 22 };

export function Plant({ stage, size = 48 }: { stage: PlantStage; size?: number }) {
  const stemTop = STEM_TOP[stage];
  return (
    <svg
      viewBox="0 0 48 64"
      width={size}
      height={(size * 64) / 48}
      aria-hidden="true"
      focusable="false"
      data-stage={stage}
    >
      <ellipse cx="24" cy={GROUND_Y + 2} rx="18" ry="5" className="fill-soil" />
      {stage === 0 && <ellipse cx="24" cy={GROUND_Y - 1} rx="3.5" ry="2.5" className="fill-growth" />}
      {stage > 0 && (
        <line
          x1="24"
          y1={GROUND_Y}
          x2="24"
          y2={stemTop}
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-growth"
        />
      )}
      {stage === 1 && (
        <>
          <Leaf y={48} side="left" size={0.7} />
          <Leaf y={48} side="right" size={0.7} />
        </>
      )}
      {stage >= 2 && (
        <>
          <Leaf y={50} side="left" />
          <Leaf y={46} side="right" />
          <Leaf y={40} side="left" size={0.8} />
        </>
      )}
      {stage >= 3 && <Leaf y={34} side="right" size={0.8} />}
      {stage === 3 && <ellipse cx="24" cy={stemTop - 2} rx="3.5" ry="5" className="fill-honey" />}
      {stage === MAX_PLANT_STAGE && (
        <g className="fill-honey">
          {[0, 72, 144, 216, 288].map((angle) => (
            <circle
              key={angle}
              cx={24 + 6 * Math.sin((angle * Math.PI) / 180)}
              cy={stemTop - 6 - 6 * Math.cos((angle * Math.PI) / 180)}
              r="4.5"
            />
          ))}
          <circle cx="24" cy={stemTop - 6} r="3" className="fill-soil" />
        </g>
      )}
    </svg>
  );
}
