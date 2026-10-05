/**
 * Finding tasks in a catalog — the teacher's task list (/tasks) and the
 * session builder's bank share it, so a filter means the same in both.
 *
 * Search matches every word typed, in any order, against the title, the topic
 * and the slug, ignoring case and the three apostrophes Ukrainian text is typed
 * with (' ’ ʼ): «пiд'єднай» finds «під’єднай». Within one facet the values are
 * alternatives (difficulty 1 or 2); across facets they all apply.
 *
 * The filter round-trips through URL search params so the list keeps its
 * filter across opening a task and coming back. Pure.
 */
import { isTaskTag, type TaskTag } from './tags';
import type { TaskStatus, TaskType } from './types';

export interface CatalogTask {
  id: string;
  slug: string;
  title: string;
  topicSlug: string;
  topicTitle: string;
  type: TaskType;
  difficulty: number;
  gradeTags: readonly number[];
  tags: readonly TaskTag[];
  /** Absent in a catalog of published tasks only. */
  status?: TaskStatus;
}

export interface CatalogFilter {
  query: string;
  /** A topic slug, or null for every topic. */
  topic: string | null;
  grade: number | null;
  types: TaskType[];
  difficulties: number[];
  tags: TaskTag[];
  status: TaskStatus | null;
}

export const EMPTY_FILTER: CatalogFilter = {
  query: '',
  topic: null,
  grade: null,
  types: [],
  difficulties: [],
  tags: [],
  status: null
};

const TASK_TYPES: readonly TaskType[] = ['quiz', 'predict', 'parsons', 'fill', 'code', 'fix'];
const STATUSES: readonly TaskStatus[] = ['draft', 'published', 'archived'];

/** Lower case, one apostrophe, Latin `i` read as Cyrillic `і` — a keyboard left on the wrong layout. */
function fold(text: string): string {
  return text.toLocaleLowerCase('uk').replace(/[’ʼ`]/g, "'").replace(/i/g, 'і');
}

export function matchesQuery(task: Pick<CatalogTask, 'title' | 'topicTitle' | 'slug'>, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fold(`${task.title} ${task.topicTitle} ${task.slug}`);
  return words.every((word) => haystack.includes(word));
}

export function matchesFilter(task: CatalogTask, filter: CatalogFilter): boolean {
  return (
    (filter.topic === null || task.topicSlug === filter.topic) &&
    (filter.grade === null || task.gradeTags.includes(filter.grade)) &&
    (filter.types.length === 0 || filter.types.includes(task.type)) &&
    (filter.difficulties.length === 0 || filter.difficulties.includes(task.difficulty)) &&
    (filter.tags.length === 0 || filter.tags.some((tag) => task.tags.includes(tag))) &&
    (filter.status === null || task.status === filter.status) &&
    matchesQuery(task, filter.query)
  );
}

export function filterCatalog<T extends CatalogTask>(tasks: readonly T[], filter: CatalogFilter): T[] {
  return tasks.filter((task) => matchesFilter(task, filter));
}

type ListFacet = 'types' | 'difficulties' | 'tags';

/**
 * How many tasks a chip would show if it were the only value picked in its
 * facet, with every other facet as it is — the count beside each chip, so a
 * teacher sees «Виклик (4)» before clicking rather than an empty list after.
 */
export function facetCount<F extends ListFacet>(
  tasks: readonly CatalogTask[],
  filter: CatalogFilter,
  facet: F,
  value: CatalogFilter[F][number]
): number {
  const probe = { ...filter, [facet]: [value] } as CatalogFilter;
  return tasks.reduce((n, task) => (matchesFilter(task, probe) ? n + 1 : n), 0);
}

/** Adds the value to its facet, or takes it out if it is there. */
export function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((existing) => existing !== value) : [...values, value];
}

export function isFilterEmpty(filter: CatalogFilter): boolean {
  return (
    filter.query.trim() === '' &&
    filter.topic === null &&
    filter.grade === null &&
    filter.types.length === 0 &&
    filter.difficulties.length === 0 &&
    filter.tags.length === 0 &&
    filter.status === null
  );
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function read(params: ParamSource, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

const list = (raw: string | undefined) => (raw ? raw.split(',').filter(Boolean) : []);

/** The filter a URL describes; anything unknown in it is ignored, never an error. */
export function filterFromParams(params: ParamSource): CatalogFilter {
  const grade = Number(read(params, 'grade'));
  const status = read(params, 'status');
  return {
    query: read(params, 'q') ?? '',
    topic: read(params, 'topic') || null,
    grade: Number.isInteger(grade) && grade > 0 ? grade : null,
    types: list(read(params, 'type')).filter((type): type is TaskType => (TASK_TYPES as readonly string[]).includes(type)),
    difficulties: [...new Set(list(read(params, 'difficulty')).map(Number))]
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5)
      .sort((a, b) => a - b),
    tags: list(read(params, 'tag')).filter(isTaskTag),
    status: STATUSES.includes(status as TaskStatus) ? (status as TaskStatus) : null
  };
}

/** The shortest URL query for a filter: empty facets are left out. */
export function filterToParams(filter: CatalogFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.query.trim()) params.set('q', filter.query.trim());
  if (filter.topic) params.set('topic', filter.topic);
  if (filter.grade !== null) params.set('grade', String(filter.grade));
  if (filter.types.length) params.set('type', filter.types.join(','));
  if (filter.difficulties.length) params.set('difficulty', [...filter.difficulties].sort((a, b) => a - b).join(','));
  if (filter.tags.length) params.set('tag', filter.tags.join(','));
  if (filter.status) params.set('status', filter.status);
  return params;
}

export type CatalogSort = 'topic' | 'difficulty' | 'title';

/** `topic` keeps the catalog's own order (curriculum order, then slug). */
export function sortCatalog<T extends CatalogTask>(tasks: readonly T[], sort: CatalogSort): T[] {
  if (sort === 'topic') return [...tasks];
  const collator = new Intl.Collator('uk');
  return [...tasks].sort((a, b) =>
    sort === 'difficulty'
      ? a.difficulty - b.difficulty || collator.compare(a.title, b.title)
      : collator.compare(a.title, b.title)
  );
}

/** A word for a difficulty, for the meter's label: 1–2 easy, 3 medium, 4–5 hard. */
export function difficultyBand(difficulty: number): 'easy' | 'medium' | 'hard' {
  if (difficulty <= 2) return 'easy';
  return difficulty === 3 ? 'medium' : 'hard';
}
