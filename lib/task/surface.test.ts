import { describe, expect, it } from 'vitest';
import { drawsTurtle, showsTurtleCanvas } from './surface';
import type { CodeTask, FillTask, FixTask } from './types';
import type { Segment } from '@/lib/runner';

const common = {
  id: 't',
  slug: 't',
  topicId: 'topic',
  title: 'T',
  hints: [],
  reference: { code: '' },
  difficulty: 1 as const,
  gradeTags: [7],
  version: 1,
  status: 'published' as const
};

function codeTask(surface: 'turtle' | 'console'): CodeTask {
  return { ...common, type: 'code', payload: { type: 'code', surface, prompt: '', starter: '' }, checks: [] };
}

function fixTask(surface: 'turtle' | 'console'): FixTask {
  return { ...common, type: 'fix', payload: { type: 'fix', surface, prompt: '', broken: '' }, checks: [] };
}

function fillTask(template: string, checks: FillTask['checks'] = []): FillTask {
  return { ...common, type: 'fill', payload: { type: 'fill', prompt: '', template }, checks };
}

const segment: Segment = { x1: 0, y1: 0, x2: 10, y2: 0, color: 'black', width: 1, line: null };

describe('drawsTurtle', () => {
  it('follows payload.surface for code and fix', () => {
    expect(drawsTurtle(codeTask('turtle'))).toBe(true);
    expect(drawsTurtle(codeTask('console'))).toBe(false);
    expect(drawsTurtle(fixTask('turtle'))).toBe(true);
    expect(drawsTurtle(fixTask('console'))).toBe(false);
  });

  it('treats a fill task with a shape check as drawing', () => {
    expect(drawsTurtle(fillTask('x = {{1}}', [{ kind: 'shape_props', closed: true }]))).toBe(true);
  });

  it('treats a fill task whose template imports turtle as drawing', () => {
    expect(drawsTurtle(fillTask('import turtle\nturtle.forward({{1}})'))).toBe(true);
    expect(drawsTurtle(fillTask('from turtle import forward\nforward({{1}})'))).toBe(true);
  });

  it('treats a console fill task as not drawing, even when the word turtle appears in a string', () => {
    expect(drawsTurtle(fillTask('print("import turtle")\nprint({{1}})', [{ kind: 'last_line_equals', value: '3' }]))).toBe(
      false
    );
  });
});

describe('showsTurtleCanvas', () => {
  it('shows a turtle task before anything has run', () => {
    expect(showsTurtleCanvas(codeTask('turtle'), [])).toBe(true);
  });

  it('hides a console task until a run actually draws', () => {
    expect(showsTurtleCanvas(codeTask('console'), [])).toBe(false);
    expect(showsTurtleCanvas(codeTask('console'), [segment])).toBe(true);
  });
});
