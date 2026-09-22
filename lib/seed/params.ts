/**
 * `tasks.params` (docs/TASK_SCHEMA.md, "Parameterization"): placeholder
 * ranges an author writes once, resolved to concrete values per student.
 * Pure — same inputs, same variant, no I/O (CLAUDE.md).
 *
 * Placeholders are written `{name}` in `payload.prompt`/`starter`, in
 * `cases[].stdin`, and in `reference.code`; `substituteParams` is the one
 * function that turns those into literal text, used identically whether
 * the caller is resolving one concrete variant (a student's session) or
 * checking every possible one (the reference-verification script).
 */
import type { Rng } from './prng';
import { randomChoice, randomInt } from './prng';

export type ParamValueSpec = { int: [number, number] } | { choice: string[] } | { float: [number, number]; step: number };

export type ParamSpec = Record<string, ParamValueSpec>;

export type ParamValue = number | string;
export type ParamValues = Record<string, ParamValue>;

/** Combinations grow multiplicatively — this is `content/seed-tasks/`'s own warning enforced, not a hypothetical. */
const MAX_COMBINATIONS = 500;

function decimalPlaces(step: number): number {
  const text = step.toString();
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Every step-aligned value from `min` to `max`, inclusive — `step` makes an otherwise-infinite float range finite. */
function floatSteps(min: number, max: number, step: number): number[] {
  const places = decimalPlaces(step);
  const count = Math.floor((max - min) / step + 1e-9) + 1;
  return Array.from({ length: count }, (_, i) => roundTo(min + i * step, places));
}

/** One concrete value per named parameter, drawn from a seeded generator — the variant one particular student sees. */
export function resolveParams(spec: ParamSpec, rng: Rng): ParamValues {
  const values: ParamValues = {};
  for (const [name, valueSpec] of Object.entries(spec)) {
    if ('int' in valueSpec) {
      values[name] = randomInt(rng, valueSpec.int[0], valueSpec.int[1]);
    } else if ('choice' in valueSpec) {
      values[name] = randomChoice(rng, valueSpec.choice);
    } else {
      values[name] = randomChoice(rng, floatSteps(valueSpec.float[0], valueSpec.float[1], valueSpec.step));
    }
  }
  return values;
}

/**
 * Every possible combination of every parameter's values — what the
 * reference-verification script runs to prove no combination breaks the
 * task's own checks (docs/AI_CONTEXT.md: "executed per-seed at publish
 * time... if the parameter space is small"). Throws rather than silently
 * running a very long check when an author's ranges are too wide —
 * TASK_SCHEMA.md already asks authors to keep the space small; this is
 * that rule enforced instead of merely stated.
 */
export function enumerateParamCombinations(spec: ParamSpec): ParamValues[] {
  const names = Object.keys(spec);
  const optionsByName = names.map((name): ParamValue[] => {
    const valueSpec = spec[name];
    if ('int' in valueSpec) {
      const [min, max] = valueSpec.int;
      return Array.from({ length: max - min + 1 }, (_, i) => min + i);
    }
    if ('choice' in valueSpec) {
      return valueSpec.choice;
    }
    return floatSteps(valueSpec.float[0], valueSpec.float[1], valueSpec.step);
  });

  const total = optionsByName.reduce((product, options) => product * options.length, 1);
  if (total > MAX_COMBINATIONS) {
    throw new Error(
      `parameter space has ${total} combinations, more than ${MAX_COMBINATIONS} — narrow the ranges (docs/TASK_SCHEMA.md, "Parameterization")`
    );
  }

  let combinations: ParamValues[] = [{}];
  names.forEach((name, i) => {
    const options = optionsByName[i];
    combinations = combinations.flatMap((combo) => options.map((value) => ({ ...combo, [name]: value })));
  });
  return combinations;
}

/** Replaces every `{name}` in `text` with its resolved value. A name with no match in `values` is left untouched. */
export function substituteParams(text: string, values: ParamValues): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}
