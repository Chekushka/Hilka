import Link from 'next/link';
import { SignupForm } from '@/components/auth/SignupForm';
import { t } from '@/lib/i18n';

/** Asking for a teacher account; the superuser approves it at /admin. */
export default function SignupPage() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-ink">{t('auth.signupTitle')}</h1>
      <p className="mt-2 text-sm text-ink-muted">{t('auth.signupIntro')}</p>
      <SignupForm />
      <Link href="/login" className="mt-6 text-sm text-accent">
        {t('auth.loginLink')}
      </Link>
    </main>
  );
}
