'use client';

/**
 * The filters over a task catalog (lib/task/catalog-filter.ts), shared by the
 * task list and the session builder's bank: search, topic and grade on one row,
 * then chips for difficulty, kind of work (tags) and type, each with the count
 * it would show. Chips are toggle buttons (`aria-pressed`), so a keyboard and a
 * screen reader get the same filter as a mouse.
 */
import type { ReactNode } from 'react';
import { DifficultyMeter, tagChipClass, tagGlyph } from '@/components/authoring/TaskBadges';
import { t } from '@/lib/i18n';
import {
  EMPTY_FILTER,
  facetCount,
  isFilterEmpty,
  toggleValue,
  type CatalogFilter,
  type CatalogTask
} from '@/lib/task/catalog-filter';
import { TASK_TAGS } from '@/lib/task/tags';
import type { TaskStatus, TaskType } from '@/lib/task/types';

const TYPES: readonly TaskType[] = ['code', 'fix', 'fill', 'parsons', 'predict', 'quiz'];
const STATUSES: readonly TaskStatus[] = ['published', 'draft'];

interface TaskFilterBarProps {
  tasks: readonly CatalogTask[];
  filter: CatalogFilter;
  onChange: (filter: CatalogFilter) => void;
  shown: number;
  /** The task list filters by draft/published too; the builder's bank holds published tasks only. */
  showStatus?: boolean;
  /** Ids for the three fields, so an existing page keeps its own (the builder's are `taskSearch`, …). */
  ids?: { search: string; topic: string; grade: string };
}

const fieldClass = 'rounded-lg border border-line bg-surface px-3 py-2 text-ink';
const labelClass = 'text-sm text-ink-muted';

function Chip({
  pressed,
  onClick,
  count,
  className = '',
  children,
  label
}: {
  pressed: boolean;
  onClick: () => void;
  count: number;
  className?: string;
  children: ReactNode;
  label: string;
}) {
  const empty = count === 0 && !pressed;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={t('catalog.chipLabel', { label, n: count })}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
        pressed
          ? 'border-accent bg-accent text-surface'
          : `${className || 'border-line text-ink'} hover:border-accent`
      } ${empty ? 'opacity-50' : ''}`}
    >
      {children}
      <span aria-hidden="true" className={`text-xs tabular-nums ${pressed ? 'text-surface/80' : 'text-ink-muted'}`}>
        {count}
      </span>
    </button>
  );
}

export function TaskFilterBar({
  tasks,
  filter,
  onChange,
  shown,
  showStatus = false,
  ids = { search: 'catalogSearch', topic: 'catalogTopic', grade: 'catalogGrade' }
}: TaskFilterBarProps) {
  const topics = [...new Map(tasks.map((task) => [task.topicSlug, task.topicTitle])).entries()];
  const grades = [...new Set(tasks.flatMap((task) => task.gradeTags))].sort((a, b) => a - b);
  const types = TYPES.filter((type) => tasks.some((task) => task.type === type));
  const set = (patch: Partial<CatalogFilter>) => onChange({ ...filter, ...patch });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4" role="search" data-testid="task-filters">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <label className={labelClass} htmlFor={ids.search}>
            {t('catalog.searchLabel')}
          </label>
          <input
            id={ids.search}
            type="search"
            value={filter.query}
            placeholder={t('catalog.searchPlaceholder')}
            onChange={(event) => set({ query: event.target.value })}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass} htmlFor={ids.topic}>
            {t('catalog.topicLabel')}
          </label>
          <select
            id={ids.topic}
            value={filter.topic ?? ''}
            onChange={(event) => set({ topic: event.target.value || null })}
            className={`max-w-[15rem] ${fieldClass}`}
          >
            <option value="">{t('catalog.all')}</option>
            {topics.map(([slug, title]) => (
              <option key={slug} value={slug}>
                {title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass} htmlFor={ids.grade}>
            {t('catalog.gradeLabel')}
          </label>
          <select
            id={ids.grade}
            value={filter.grade ?? ''}
            onChange={(event) => set({ grade: event.target.value ? Number(event.target.value) : null })}
            className={fieldClass}
          >
            <option value="">{t('catalog.all')}</option>
            {grades.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </div>
        {showStatus && (
          <div className="flex flex-col gap-1">
            <span className={labelClass} id="catalogStatusLabel">
              {t('catalog.statusLabel')}
            </span>
            <div className="flex gap-1.5" role="group" aria-labelledby="catalogStatusLabel">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={filter.status === status}
                  onClick={() => set({ status: filter.status === status ? null : status })}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    filter.status === status ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-muted hover:text-ink'
                  }`}
                >
                  {t(`catalog.status.${status}`)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('catalog.tagsLabel')}>
          <span className="mr-1 text-sm text-ink-muted" aria-hidden="true">
            {t('catalog.tagsLabel')}
          </span>
          {TASK_TAGS.map((tag) => (
            <Chip
              key={tag}
              pressed={filter.tags.includes(tag)}
              onClick={() => set({ tags: toggleValue(filter.tags, tag) })}
              count={facetCount(tasks, filter, 'tags', tag)}
              className={tagChipClass(tag)}
              label={t(`catalog.tag.${tag}`)}
            >
              <span aria-hidden="true">{tagGlyph(tag)}</span>
              {t(`catalog.tag.${tag}`)}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('catalog.difficultyFilterLabel')}>
          <span className="mr-1 text-sm text-ink-muted" aria-hidden="true">
            {t('catalog.difficultyFilterLabel')}
          </span>
          {[1, 2, 3, 4, 5].map((level) => (
            <Chip
              key={level}
              pressed={filter.difficulties.includes(level)}
              onClick={() => set({ difficulties: toggleValue(filter.difficulties, level).sort((a, b) => a - b) })}
              count={facetCount(tasks, filter, 'difficulties', level)}
              label={t('catalog.difficultyChip', { n: level })}
            >
              <DifficultyMeter difficulty={level} compact />
              <span className="tabular-nums">{level}</span>
            </Chip>
          ))}
        </div>
      </div>

      {types.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('catalog.typeLabel')}>
          <span className="mr-1 text-sm text-ink-muted" aria-hidden="true">
            {t('catalog.typeLabel')}
          </span>
          {types.map((type) => (
            <Chip
              key={type}
              pressed={filter.types.includes(type)}
              onClick={() => set({ types: toggleValue(filter.types, type) })}
              count={facetCount(tasks, filter, 'types', type)}
              label={t(`task.types.${type}`)}
            >
              {t(`task.types.${type}`)}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <span aria-live="polite" data-testid="catalog-shown">
          {t('catalog.shown', { shown, total: tasks.length })}
        </span>
        {!isFilterEmpty(filter) && (
          <button type="button" onClick={() => onChange(EMPTY_FILTER)} className="text-sm text-accent hover:underline">
            {t('catalog.reset')}
          </button>
        )}
      </div>
    </div>
  );
}
