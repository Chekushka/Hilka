'use client';

/**
 * A `fill` task with a word bank (docs/TASK_SCHEMA.md, `fill`): the gaps take
 * cards instead of typing. A card is dragged onto a gap, or — for a keyboard,
 * a touch screen or a student who does not drag — tapped: it goes into the
 * chosen gap, or the first empty one. A filled gap tapped (or its card dragged
 * back to the tray) gives the card back. Every card goes in once; the code
 * that runs is the template with each gap's card in it, exactly as typing it
 * would have been, so the run, the checks and the result are `fill`'s own.
 */
import { useState, type ReactNode } from 'react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import { t } from '@/lib/i18n';
import type { FillPart } from '@/lib/task/fill';

/** Which card sits in which gap: gap index → card index. */
export type BankPlacement = Record<number, number>;

export const isBankPlacement = (value: unknown): value is BankPlacement =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((card) => Number.isInteger(card) && card >= 0);

/** The gap values a placement means, for substitution into the template. */
export function placementValues(placement: BankPlacement, bank: readonly string[]): Record<number, string> {
  return Object.fromEntries(
    Object.entries(placement)
      .filter(([, card]) => card < bank.length)
      .map(([gap, card]) => [Number(gap), bank[card]])
  );
}

const TRAY_ID = 'tray';
const cardId = (card: number) => `card-${card}`;
const gapId = (gap: number) => `gap-${gap}`;

function Card({
  card,
  text,
  placed,
  onTap,
  label
}: {
  card: number;
  text: string;
  placed: boolean;
  onTap: () => void;
  label: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: cardId(card) });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      // dnd-kit's own role description would announce a drag the keyboard path does not need; a tap places it.
      aria-roledescription={undefined}
      onClick={onTap}
      aria-label={label}
      data-testid={placed ? 'bank-placed-card' : 'bank-card'}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={`relative inline-flex touch-none select-none items-center rounded-lg border-2 px-2.5 py-0.5 font-mono text-base font-semibold shadow-sm ${
        isDragging ? 'z-20 cursor-grabbing border-accent bg-surface shadow-lg' : 'cursor-grab'
      } ${placed ? 'border-accent bg-accent-soft text-ink' : 'border-honey bg-honey-soft text-ink hover:border-accent'}`}
    >
      {text}
    </button>
  );
}

function Gap({
  gap,
  selected,
  onSelect,
  children
}: {
  gap: number;
  selected: boolean;
  onSelect: () => void;
  children?: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: gapId(gap) });
  if (children) {
    return (
      <span ref={setNodeRef} className={`mx-0.5 inline-block rounded-lg ${isOver ? 'ring-2 ring-accent' : ''}`}>
        {children}
      </span>
    );
  }
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      aria-label={t('fill.emptyGapLabel', { n: gap })}
      aria-pressed={selected}
      data-testid="bank-gap"
      className={`mx-0.5 inline-block min-w-[3.5rem] rounded-lg border-2 border-dashed px-2 py-0.5 align-middle font-mono text-base ${
        isOver || selected ? 'border-solid border-accent bg-accent-soft' : 'border-accent/70 bg-surface'
      }`}
    >
      <span aria-hidden="true" className="text-ink-muted">
        {gap}
      </span>
    </button>
  );
}

function Tray({ children, empty }: { children: ReactNode; empty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: TRAY_ID });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby="bank-title"
      className={`border-t-2 border-line px-5 py-3 ${isOver ? 'bg-accent-soft' : 'bg-shell'}`}
      data-testid="bank-tray"
    >
      <h2 id="bank-title" className="mb-2 text-sm font-semibold text-ink-muted">
        {t('fill.bankTitle')}
      </h2>
      <div className="flex min-h-9 flex-wrap gap-2">
        {empty ? <p className="text-sm text-ink-muted">{t('fill.bankEmpty')}</p> : children}
      </div>
    </section>
  );
}

export function BankTemplate({
  parts,
  bank,
  placement,
  onChange
}: {
  parts: FillPart[];
  bank: readonly string[];
  placement: BankPlacement;
  onChange: (next: BankPlacement) => void;
}) {
  // The gap a tapped card goes to; the first empty gap when none is chosen.
  const [selectedGap, setSelectedGap] = useState<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const gaps = [...new Set(parts.flatMap((part) => (part.kind === 'gap' ? [part.index] : [])))];
  const used = new Set(Object.values(placement));
  const free = bank.map((_, card) => card).filter((card) => !used.has(card));
  const gapOfCard = (card: number) => {
    const entry = Object.entries(placement).find(([, placed]) => placed === card);
    return entry ? Number(entry[0]) : null;
  };

  const put = (card: number, gap: number) => {
    const next: BankPlacement = { ...placement };
    const from = gapOfCard(card);
    if (from !== null) delete next[from];
    // A card already in the target gap swaps into the card's old gap, or back to the tray.
    const displaced = next[gap];
    next[gap] = card;
    if (displaced !== undefined && from !== null) next[from] = displaced;
    onChange(next);
  };
  const takeBack = (gap: number) => {
    const next: BankPlacement = { ...placement };
    delete next[gap];
    onChange(next);
  };

  const tapCard = (card: number) => {
    const target = selectedGap !== null && placement[selectedGap] === undefined ? selectedGap : gaps.find((gap) => placement[gap] === undefined);
    if (target === undefined) return;
    put(card, target);
    setSelectedGap(null);
  };

  function handleDragEnd(event: DragEndEvent) {
    const card = Number(String(event.active.id).replace('card-', ''));
    const over = event.over ? String(event.over.id) : null;
    if (over === null) return;
    if (over === TRAY_ID) {
      const from = gapOfCard(card);
      if (from !== null) takeBack(from);
      return;
    }
    put(card, Number(over.replace('gap-', '')));
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-1 flex-col">
        {/* Same size and face as the editor, so a gap reads as part of the program. */}
        <div className="flex-1 overflow-auto whitespace-pre-wrap px-5 py-4 font-mono text-base leading-[2.3] text-ink">
          {parts.map((part, index) => {
            if (part.kind === 'text') return <span key={index}>{part.value}</span>;
            const card = placement[part.index];
            return (
              <Gap
                key={index}
                gap={part.index}
                selected={selectedGap === part.index}
                onSelect={() => setSelectedGap((previous) => (previous === part.index ? null : part.index))}
              >
                {card !== undefined && card < bank.length && (
                  <Card
                    card={card}
                    text={bank[card]}
                    placed
                    onTap={() => takeBack(part.index)}
                    label={t('fill.placedCardLabel', { n: part.index, card: bank[card] })}
                  />
                )}
              </Gap>
            );
          })}
        </div>
        <Tray empty={free.length === 0}>
          {free.map((card) => (
            <Card key={card} card={card} text={bank[card]} placed={false} onTap={() => tapCard(card)} label={t('fill.cardLabel', { card: bank[card] })} />
          ))}
        </Tray>
      </div>
    </DndContext>
  );
}
