import type { Check } from './types';

/**
 * The fallback line shown when an author wrote no `message` for a check.
 *
 * Guidance, never a verdict: «Неправильно» tells a student nothing and reads as
 * a judgement. These are in Ukrainian because they are shown to students, and
 * they are data rather than interface strings, which is the documented
 * exception to keeping user-facing text in messages/uk.json.
 */
const FALLBACKS: Record<Check['kind'], string> = {
  choice_equals: 'Не та відповідь. Перечитай варіанти ще раз.',
  order_equals: 'Рядки стоять не в тому порядку.',
  text_equals: 'Відповідь не збігається з очікуваною.',
  stdout_equals: 'Програма вивела не те, що потрібно.',
  stdout_contains: 'У виведенні бракує потрібного тексту.',
  last_line_equals: 'Останній рядок виведення не той, що потрібен.',
  number_close: 'Число у відповіді не те, що потрібно.',
  numbers_equal: 'Числа у виведенні не збігаються з очікуваними.',
  var_equals: 'Змінна має інше значення, ніж потрібно.',
  expr: 'Умова задачі ще не виконана.',
  shape_equals: 'Малюнок відрізняється від зразка.',
  shape_contains: 'У малюнку бракує частини фігури.',
  shape_props: 'Фігура має інші властивості, ніж потрібно.',
  uses: 'У розв’язку бракує потрібної конструкції.',
  forbids: 'У розв’язку є те, чого в цій задачі використовувати не можна.',
  grid_goal: 'Герой ще не дійшов до цілі.'
};

export function fallbackMessage(check: Check): string {
  return FALLBACKS[check.kind];
}
