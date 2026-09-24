import { expect, test, type Page } from '@playwright/test';

/**
 * A file-delivery `code` task inside a session (docs/TASK_SCHEMA.md, "File
 * Delivery"): download the generated starter, "edit it in IDLE" (here: edit
 * the bytes), upload it back, and get the same Check flow an inline task
 * gets. Seeded by content/seed-tasks/grade8-code-idle-hello.json.
 */

const DEMO_CODE = 'demo01';
const TASK_TITLE = 'Перша програма в IDLE';

async function openFileTask(page: Page, name: string) {
  await page.goto(`/s/${DEMO_CODE}`);
  await page.getByRole('button', { name }).click();
  await page.getByRole('button', { name: TASK_TITLE }).click();
  await expect(page.getByRole('button', { name: /Завантажити файл hello_idle\.py/ })).toBeVisible({ timeout: 30_000 });
}

test('downloaded starter carries the header; an edited upload is checked', async ({ page }) => {
  await openFileTask(page, 'Олена');

  // Nothing to run until a file arrives.
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeDisabled();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Завантажити файл/ }).click()
  ]);
  expect(download.suggestedFilename()).toBe('hello_idle.py');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const starter = Buffer.concat(chunks).toString('utf8');
  expect(starter).toMatch(/^# .*\n# hilka-task: \S+\n# hilka-version: 1\n/);
  expect(starter).toContain('# Твій код — нижче цього рядка');

  // What IDLE on Windows might plausibly hand back: BOM and CRLF.
  const edited = `﻿${starter}print("Привіт, IDLE!")\n`.replace(/\n/g, '\r\n');
  const input = page.locator('input[type="file"]');

  await input.setInputFiles({ name: 'hello_idle.py', mimeType: 'text/x-python', buffer: Buffer.from(edited, 'utf8') });
  await expect(page.getByText('Отримано файл hello_idle.py')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });

  const [attemptResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/attempts') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Перевірити' }).click()
  ]);
  expect(attemptResponse.status()).toBe(201);
  const body = attemptResponse.request().postDataJSON() as { submittedAnswer: { code: string } };
  // Stored verbatim as normalized: no BOM, no CR.
  expect(body.submittedAnswer.code).not.toMatch(/[﻿\r]/);
  expect(body.submittedAnswer.code).toContain('print("Привіт, IDLE!")');
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });
});

test('a renamed document is rejected with an instruction, not a verdict', async ({ page }) => {
  await openFileTask(page, 'Олена');
  const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
  await page.locator('input[type="file"]').setInputFiles({ name: 'hello_idle.py', mimeType: 'text/x-python', buffer: zip });
  await expect(page.getByRole('alert').filter({ hasText: /./ })).toContainText('Збережи код в IDLE');
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeDisabled();
});

test('a wrong extension is rejected before anything else', async ({ page }) => {
  await openFileTask(page, 'Олена');
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'hello_idle.txt', mimeType: 'text/plain', buffer: Buffer.from('print(1)\n') });
  await expect(page.getByRole('alert').filter({ hasText: /./ })).toContainText('.py');
});

test('valid Python Hilka cannot run is FILE_UNSUPPORTED, named, with a replacement', async ({ page }) => {
  await openFileTask(page, 'Олена');
  const source = 'import os\nword = input()\nprint(word.isalpha())\n';
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'hello_idle.py', mimeType: 'text/x-python', buffer: Buffer.from(source, 'utf8') });

  const notice = page.getByRole('alert').filter({ hasText: 'Hilka поки що не вміє' });
  await expect(notice).toBeVisible({ timeout: 30_000 });
  // A platform limitation, stated as one — never a wrong answer.
  await expect(notice).toContainText('не твоя помилка');
  await expect(notice).toContainText('Рядок 1: модуль os');
  await expect(notice).toContainText('Рядок 3: метод .isalpha()');
  await expect(notice).toContainText('ch.lower() != ch.upper()');
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeDisabled();

  // Fixing it and sending it again clears the notice and lets Check through.
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'hello_idle.py', mimeType: 'text/x-python', buffer: Buffer.from('print("Привіт, IDLE!")\n', 'utf8') });
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });
});
