import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTER,
  difficultyBand,
  facetCount,
  filterCatalog,
  filterFromParams,
  filterToParams,
  isFilterEmpty,
  matchesQuery,
  sortCatalog,
  toggleValue,
  type CatalogTask
} from './catalog-filter';

const task = (overrides: Partial<CatalogTask>): CatalogTask => ({
  id: overrides.slug ?? 'x',
  slug: 'x',
  title: 'Завдання',
  topicSlug: 'loops',
  topicTitle: 'Цикли',
  type: 'code',
  difficulty: 2,
  gradeTags: [7],
  tags: [],
  status: 'published',
  ...overrides
});

const catalog = [
  task({ slug: 'g7-square', title: 'Квадрат', topicSlug: 'turtle', topicTitle: 'Черепашка', difficulty: 1, tags: ['retype'] }),
  task({ slug: 'g7-star', title: 'Зірка з п’яти променів', topicSlug: 'turtle', topicTitle: 'Черепашка', difficulty: 4, tags: ['challenge'] }),
  task({ slug: 'g7-sum', title: 'Сума до нуля', difficulty: 3, type: 'fix' }),
  task({ slug: 'g8-bmi', title: 'Індекс маси тіла', topicSlug: 'bmi', topicTitle: 'ІМТ', gradeTags: [8], difficulty: 5, status: 'draft' })
];

describe('matchesQuery', () => {
  it('needs every word, in any order, across title, topic and slug', () => {
    expect(matchesQuery(catalog[0], 'черепашка квадрат')).toBe(true);
    expect(matchesQuery(catalog[0], 'квадрат цикли')).toBe(false);
    expect(matchesQuery(catalog[3], 'g8 bmi')).toBe(true);
  });

  it('ignores case and which apostrophe was typed', () => {
    expect(matchesQuery(catalog[1], "П'ЯТИ")).toBe(true);
    expect(matchesQuery(catalog[1], 'пʼяти')).toBe(true);
  });

  it('reads a Latin i as the Ukrainian і', () => {
    expect(matchesQuery(catalog[3], 'iндекс')).toBe(true);
  });

  it('matches everything on an empty query', () => {
    expect(matchesQuery(catalog[2], '   ')).toBe(true);
  });
});

describe('filterCatalog', () => {
  const slugs = (filter: Partial<typeof EMPTY_FILTER>) =>
    filterCatalog(catalog, { ...EMPTY_FILTER, ...filter }).map((entry) => entry.slug);

  it('treats values within a facet as alternatives', () => {
    expect(slugs({ difficulties: [1, 5] })).toEqual(['g7-square', 'g8-bmi']);
    expect(slugs({ tags: ['retype', 'challenge'] })).toEqual(['g7-square', 'g7-star']);
  });

  it('applies every facet together', () => {
    expect(slugs({ topic: 'turtle', difficulties: [4] })).toEqual(['g7-star']);
    expect(slugs({ grade: 7, status: 'published', types: ['fix'] })).toEqual(['g7-sum']);
    expect(slugs({ grade: 8, status: 'published' })).toEqual([]);
  });

  it('counts what a chip would show, keeping the other facets', () => {
    const filter = { ...EMPTY_FILTER, topic: 'turtle', difficulties: [4] };
    expect(facetCount(catalog, filter, 'difficulties', 1)).toBe(1);
    expect(facetCount(catalog, filter, 'tags', 'challenge')).toBe(1);
    expect(facetCount(catalog, filter, 'tags', 'easy-start')).toBe(0);
  });
});

describe('filter in the URL', () => {
  it('round-trips', () => {
    const filter = {
      query: 'квадрат',
      topic: 'turtle',
      grade: 7,
      types: ['code' as const, 'fix' as const],
      difficulties: [1, 3],
      tags: ['retype' as const],
      status: 'draft' as const
    };
    expect(filterFromParams(filterToParams(filter))).toEqual(filter);
  });

  it('leaves empty facets out and reads nothing as the empty filter', () => {
    expect(filterToParams(EMPTY_FILTER).toString()).toBe('');
    expect(filterFromParams(new URLSearchParams())).toEqual(EMPTY_FILTER);
    expect(isFilterEmpty(filterFromParams({}))).toBe(true);
  });

  it('ignores what it does not know', () => {
    expect(
      filterFromParams({ type: 'code,essay', difficulty: '9,2,2', tag: 'hard,challenge', status: 'gone', grade: 'x' })
    ).toEqual({ ...EMPTY_FILTER, types: ['code'], difficulties: [2], tags: ['challenge'] });
  });
});

describe('sorting and bands', () => {
  it('sorts by difficulty, then title', () => {
    expect(sortCatalog(catalog, 'difficulty').map((entry) => entry.difficulty)).toEqual([1, 3, 4, 5]);
    expect(sortCatalog(catalog, 'title')[0].title).toBe('Зірка з п’яти променів');
    expect(sortCatalog(catalog, 'topic')).toEqual(catalog);
  });

  it('names a difficulty band', () => {
    expect([1, 2, 3, 4, 5].map(difficultyBand)).toEqual(['easy', 'easy', 'medium', 'hard', 'hard']);
  });

  it('toggles a value in a facet', () => {
    expect(toggleValue([1, 2], 2)).toEqual([1]);
    expect(toggleValue([1], 3)).toEqual([1, 3]);
  });
});
