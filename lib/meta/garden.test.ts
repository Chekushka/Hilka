import { describe, expect, it } from 'vitest';
import { MAX_PLANT_STAGE, PLANT_SPECIES, plantSpecies, plantStage, stageGainedByPass } from './garden';

describe('plantStage', () => {
  it('is a seed with nothing done', () => {
    expect(plantStage(0, 5)).toBe(0);
  });

  it('is a seed for a topic with no tasks', () => {
    expect(plantStage(0, 0)).toBe(0);
  });

  it('sprouts on the first solved task, however large the topic', () => {
    expect(plantStage(1, 9)).toBe(1);
    expect(plantStage(1, 50)).toBe(1);
  });

  it('flowers only when the topic is complete', () => {
    expect(plantStage(5, 5)).toBe(MAX_PLANT_STAGE);
    expect(plantStage(8, 9)).toBeLessThan(MAX_PLANT_STAGE);
  });

  it('never shrinks as more tasks are done', () => {
    for (const total of [1, 2, 3, 5, 9, 13]) {
      let previous = plantStage(0, total);
      for (let done = 1; done <= total; done += 1) {
        const stage = plantStage(done, total);
        expect(stage).toBeGreaterThanOrEqual(previous);
        previous = stage;
      }
    }
  });

  it('passes through every growing stage in a topic of nine', () => {
    const stages = new Set(Array.from({ length: 10 }, (_, done) => plantStage(done, 9)));
    expect([...stages].sort()).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('stageGainedByPass', () => {
  const topic = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('reports the new stage when a pass makes the plant grow', () => {
    expect(stageGainedByPass(topic, new Set(), 'a')).toBe(1);
  });

  it('reports growth only when the pass crosses into the next stage', () => {
    // 1 of 6 → 2 of 6 grows (a third is a young plant); 3 of 6 does not.
    expect(stageGainedByPass(topic, new Set(['a']), 'b')).toBe(2);
    expect(stageGainedByPass(topic, new Set(['a', 'b']), 'c')).toBeNull();
  });

  it('is null for a task already completed', () => {
    expect(stageGainedByPass(topic, new Set(['a']), 'a')).toBeNull();
  });

  it('is null for a task outside the topic', () => {
    expect(stageGainedByPass(topic, new Set(), 'zzz')).toBeNull();
  });

  it('reports the flower on the pass that completes the topic', () => {
    expect(stageGainedByPass(topic, new Set(['a', 'b', 'c', 'd', 'e']), 'f')).toBe(MAX_PLANT_STAGE);
  });
});

describe('plantSpecies', () => {
  it('gives neighbouring topics different plants', () => {
    for (let order = 1; order < 40; order += 1) {
      expect(plantSpecies(order)).not.toBe(plantSpecies(order + 1));
    }
  });

  it('uses every kind before repeating one', () => {
    const first = PLANT_SPECIES.map((_, index) => plantSpecies(index + 1));
    expect(new Set(first).size).toBe(PLANT_SPECIES.length);
  });

  it('is the same for the same order, and copes with odd input', () => {
    expect(plantSpecies(5)).toBe(plantSpecies(5));
    expect(PLANT_SPECIES).toContain(plantSpecies(0));
    expect(PLANT_SPECIES).toContain(plantSpecies(-3));
    expect(PLANT_SPECIES).toContain(plantSpecies(Number.NaN));
  });
});
