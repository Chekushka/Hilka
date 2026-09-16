import { LoginForm } from '@/components/auth/LoginForm';
import { t } from '@/lib/i18n';

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-ink">{t('auth.loginTitle')}</h1>
      {error === 'invalid' && <p className="mt-2 text-sm text-attention">{t('auth.invalidToken')}</p>}
      <LoginForm />
    </main>
  );
}
