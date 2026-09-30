import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Teacher sign-up with approval and the superuser (docs/AI_CONTEXT.md,
 * "Teacher Auth"). The server needs SUPERUSER_LOGIN / SUPERUSER_PASSWORD_HASH;
 * CI sets throwaway ones (.github/workflows/ci.yml), matching these.
 *
 * The superuser works in a context of its own, on the configured origin; the
 * teacher's magic link lands on another (docs/AI_CONTEXT.md, Gotchas), so the
 * two never share cookies by accident.
 */

const SUPERUSER_LOGIN = 'ci-superuser';
const SUPERUSER_PASSWORD = 'ci-superuser-password';

function uniqueEmail(label: string): string {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@school.ua`;
}

async function superuserPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/admin/login');
  await page.getByLabel('Логін').fill(SUPERUSER_LOGIN);
  await page.getByLabel('Пароль').fill(SUPERUSER_PASSWORD);
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page.getByRole('heading', { name: 'Доступ для вчителів' })).toBeVisible();
  return page;
}

/** The dev-mode login link, or null when the server sent nothing — how a pending teacher is answered. */
async function requestLoginLink(page: Page, email: string): Promise<string | null> {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(email);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  await expect(page.getByText(/Якщо ця адреса має доступ/)).toBeVisible();
  const link = page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ });
  return (await link.count()) > 0 ? link.getAttribute('href') : null;
}

test('a teacher asks for access, waits for approval, logs in, and is logged out when disabled', async ({ page, browser }) => {
  const email = uniqueEmail('signup');

  await page.goto('/login');
  await page.getByRole('link', { name: 'Ще немає доступу? Попроси його' }).click();
  // Both pages have an email field: wait for this one before typing.
  await expect(page.getByRole('heading', { name: 'Запит на доступ для вчителя' })).toBeVisible();
  await page.getByLabel('Електронна пошта').fill(email.toUpperCase());
  await page.getByRole('button', { name: 'Надіслати запит' }).click();
  await expect(page.getByRole('status')).toHaveText(/Запит прийнято/);

  // Pending: answered exactly like an unknown address, no link.
  expect(await requestLoginLink(page, email)).toBeNull();

  const admin = await superuserPage(browser);
  const pending = admin.getByRole('region', { name: 'Запити на доступ' });
  // Stored lowercase, however it was typed.
  await expect(pending).toContainText(email);
  await admin.getByRole('button', { name: `Схвалити: ${email}` }).click();
  await expect(admin.getByRole('region', { name: 'Вчителі з доступом' })).toContainText(email);
  await expect(pending).not.toContainText(email);

  const href = await requestLoginLink(page, email);
  expect(href).not.toBeNull();
  await page.goto(href!);
  await expect(page.getByRole('heading', { name: 'Мої класи' })).toBeVisible();

  // Disabled: the very next request is logged out, and no new link is sent.
  await admin.getByRole('button', { name: `Вимкнути доступ: ${email}` }).click();
  await expect(admin.getByRole('region', { name: 'Доступ вимкнено' })).toContainText(email);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Вхід для вчителя' })).toBeVisible();
  expect(await requestLoginLink(page, email)).toBeNull();

  // Asking again changes nothing for a disabled address.
  await page.goto('/signup');
  await page.getByLabel('Електронна пошта').fill(email);
  await page.getByRole('button', { name: 'Надіслати запит' }).click();
  await expect(page.getByRole('status')).toHaveText(/Запит прийнято/);
  await admin.reload();
  await expect(admin.getByRole('region', { name: 'Запити на доступ' })).not.toContainText(email);
  await expect(admin.getByRole('region', { name: 'Доступ вимкнено' })).toContainText(email);

  // Re-enabled: a link works again.
  await admin.getByRole('button', { name: `Повернути доступ: ${email}` }).click();
  await expect(admin.getByRole('region', { name: 'Вчителі з доступом' })).toContainText(email);
  expect(await requestLoginLink(page, email)).not.toBeNull();
});

test('the superuser rejects a request and adds a teacher directly', async ({ page, browser }) => {
  const rejected = uniqueEmail('rejected');
  const added = uniqueEmail('added');

  await page.goto('/signup');
  await page.getByLabel('Електронна пошта').fill(rejected);
  await page.getByRole('button', { name: 'Надіслати запит' }).click();
  await expect(page.getByRole('status')).toHaveText(/Запит прийнято/);

  const admin = await superuserPage(browser);
  await admin.getByRole('button', { name: `Відхилити: ${rejected}` }).click();
  await expect(admin.getByRole('region', { name: 'Запити на доступ' })).not.toContainText(rejected);
  await expect(admin.getByRole('main')).not.toContainText(rejected);

  await admin.getByLabel('Електронна пошта вчителя').fill(added);
  await admin.getByRole('button', { name: 'Додати' }).click();
  await expect(admin.getByRole('region', { name: 'Вчителі з доступом' })).toContainText(added);

  const href = await requestLoginLink(page, added);
  await page.goto(href!);
  await expect(page.getByRole('heading', { name: 'Мої класи' })).toBeVisible();
});

test('the superuser area refuses a wrong password and anyone not logged in', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Вхід для адміністратора' })).toBeVisible();

  await page.getByLabel('Логін').fill(SUPERUSER_LOGIN);
  await page.getByLabel('Пароль').fill('not-the-password');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page.locator('form').getByRole('alert')).toHaveText('Невірний логін або пароль.');

  const statuses = await page.evaluate(async () => {
    const add = await fetch('/api/admin/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'intruder@school.ua' })
    });
    const patch = await fetch('/api/admin/teachers/00000000-0000-0000-0000-000000000000', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' })
    });
    const signup = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not an email' })
    });
    return [add.status, patch.status, signup.status];
  });
  expect(statuses).toEqual([401, 401, 400]);
});
