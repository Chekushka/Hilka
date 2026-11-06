import { expect, test } from '@playwright/test';

/**
 * A lesson's theory as cards (lib/lessons/theory.ts): one card at a time, a
 * «Як думаєш?» card answered before moving on and never held against the
 * student, code notes opened at a tap, «Запам'ятай» rules as tiles to flip,
 * and 10 XP the first time the deck is finished. Uses the seeded «Змінні»
 * lesson: six cards, two guesses.
 */

test('the theory deck waits for an answer, takes a wrong one calmly, and earns XP once at the end', async ({ page }) => {
  await page.goto('/practice/g7-26-variables');
  const deck = page.getByTestId('theory-deck');
  const position = page.getByTestId('theory-position');
  const next = deck.getByRole('button', { name: 'Далі' });
  await expect(position).toHaveText('Картка 1 з 6');
  await expect(deck.getByRole('button', { name: 'Назад' })).toBeHidden();
  await expect(deck.getByTestId('card-band')).toHaveText('Ідея');

  // A notes block: a line's comment opens under it at a tap, and closes again.
  const notes = deck.getByTestId('theory-notes');
  await expect(notes).not.toContainText('у змінну city кладемо текст');
  await notes.getByRole('button', { name: 'Пояснення до рядка 1' }).click();
  await expect(notes).toContainText('у змінну city кладемо текст');
  await notes.getByRole('button', { name: 'Пояснення до рядка 1' }).click();
  await expect(notes).not.toContainText('у змінну city кладемо текст');

  await next.click();
  await expect(position).toHaveText('Картка 2 з 6');
  // The arrow keys move too, once the deck has the focus.
  await page.keyboard.press('ArrowRight');
  await expect(position).toHaveText('Картка 3 з 6');
  // The progress bar leads back to a card already seen, not ahead.
  await expect(deck.getByRole('button', { name: 'До картки 5' })).toBeDisabled();
  await deck.getByRole('button', { name: 'До картки 1' }).click();
  await expect(position).toHaveText('Картка 1 з 6');
  await deck.getByRole('button', { name: 'До картки 3' }).click();
  await expect(position).toHaveText('Картка 3 з 6');

  // A «Як думаєш?» card: no way on until an answer is picked.
  const guess = deck.getByTestId('guess-card');
  await expect(guess).toBeVisible();
  await expect(deck.getByTestId('card-band')).toHaveText('Як думаєш?');
  await expect(next).toBeDisabled();
  await expect(deck).toContainText('Обери відповідь');
  await page.keyboard.press('ArrowRight');
  await expect(position).toHaveText('Картка 3 з 6');

  // A wrong guess shows the real output and why, in the same calm tone.
  await guess.getByRole('button', { name: /^5$/ }).click();
  await expect(deck.getByTestId('guess-feedback')).toContainText('Не зовсім');
  // The real output, printed as the program would print it.
  await expect(deck.getByTestId('guess-output')).toContainText('7');
  await expect(guess.getByRole('button', { name: /^7\W*так виведе програма$/ })).toBeVisible();
  await expect(guess.getByRole('button', { name: /^5\W*твоя відповідь$/ })).toBeDisabled();
  await expect(next).toBeEnabled();
  // The way on took the focus from the answered option, so the keys still work.
  await page.keyboard.press('ArrowRight');
  await expect(position).toHaveText('Картка 4 з 6');

  // Back keeps the answer; forward again.
  await deck.getByRole('button', { name: 'Назад' }).click();
  await expect(deck.getByTestId('guess-feedback')).toBeVisible();
  await next.click();
  await next.click();
  await deck.getByTestId('guess-card').getByRole('button', { name: /^Привіт, Оля!$/ }).click();
  await expect(deck.getByTestId('guess-feedback')).toContainText('Так, саме це!');
  await next.click();

  // The last card: the rules to keep as tiles to flip, the deck done, 10 XP, and the way into the tasks.
  await expect(position).toHaveText('Картка 6 з 6');
  await expect(deck.getByTestId('card-band')).toHaveText("Запам'ятай");
  const tile = deck.getByTestId('flip-tile').first();
  await expect(tile).toContainText('x = 5');
  await expect(tile).not.toContainText('покласти 5 у змінну x');
  await tile.click();
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
  await expect(tile).toContainText('покласти 5 у змінну x');
  await expect(deck.getByTestId('theory-done')).toContainText('Теорію пройдено!');
  await expect(deck.getByTestId('theory-xp')).toHaveText('+10 XP');
  await expect(deck.getByTestId('lesson-start')).toBeVisible();

  await page.goto('/practice');
  await expect(page.getByTestId('xp-total')).toHaveText('10 XP');

  // A second time through is welcome, but earns nothing new.
  await page.goto('/practice/g7-26-variables');
  for (let card = 1; card < 6; card++) {
    const options = deck.getByTestId('guess-card').getByRole('button');
    if ((await options.count()) > 0) await options.first().click();
    await next.click();
  }
  await expect(deck.getByTestId('theory-done')).toBeVisible();
  await expect(deck.getByTestId('theory-xp')).toHaveCount(0);
  await page.goto('/practice');
  await expect(page.getByTestId('xp-total')).toHaveText('10 XP');
});
