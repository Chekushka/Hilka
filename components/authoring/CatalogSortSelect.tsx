'use client';

/**
 * How a task list is ordered — by topic (the curriculum's order), by
 * difficulty either way, or by title. Shared by the task catalog and both
 * task banks (session builder, routes editor), so a sort reads the same in each.
 */
import { t } from '@/lib/i18n';
import { CATALOG_SORTS, type CatalogSort } from '@/lib/task/catalog-filter';

export function CatalogSortSelect({
  id,
  value,
  onChange
}: {
  id: string;
  value: CatalogSort;
  onChange: (sort: CatalogSort) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <label htmlFor={id} className="text-ink-muted">
        {t('catalog.sortLabel')}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as CatalogSort)}
        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-ink"
      >
        {CATALOG_SORTS.map((option) => (
          <option key={option} value={option}>
            {t(`catalog.sort.${option}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
