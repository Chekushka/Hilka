import type { AnswerView } from '@/lib/dashboard/submitted-answer';
import { t } from '@/lib/i18n';

/** Numbered lines on the code background, as the student's editor showed them. */
function CodeLines({ lines }: { lines: { text: string; indent?: number; note?: string }[] }) {
  return (
    <ol className="overflow-x-auto rounded-lg bg-code-bg py-3 font-mono text-[0.9rem] leading-relaxed">
      {lines.map((line, index) => (
        <li key={index} className="flex gap-4 px-4">
          <span className="w-6 shrink-0 select-none text-right text-ink-muted">{index + 1}</span>
          <span className="whitespace-pre text-ink">
            {'    '.repeat(line.indent ?? 0)}
            {line.text}
          </span>
          {line.note && <span className="font-sans text-xs text-attention">{line.note}</span>}
        </li>
      ))}
    </ol>
  );
}

/** What the student submitted, read back from the attempt (lib/dashboard/submitted-answer.ts). */
export function SubmittedAnswer({ view }: { view: AnswerView }) {
  switch (view.kind) {
    case 'code': {
      const lines = view.code.replace(/\n$/, '').split('\n');
      return (
        <div>
          <p className="mb-2 text-xs font-semibold text-ink-muted">{t('studentCard.answerCode')}</p>
          <CodeLines lines={lines.map((text) => ({ text }))} />
        </div>
      );
    }
    case 'text':
      return (
        <div>
          <p className="mb-2 text-xs font-semibold text-ink-muted">{t('studentCard.answerText')}</p>
          <pre className="whitespace-pre-wrap rounded-lg bg-code-bg px-4 py-3 font-mono text-[0.9rem] text-ink">
            {view.text}
          </pre>
        </div>
      );
    case 'choices':
      return (
        <div>
          <p className="mb-2 text-xs font-semibold text-ink-muted">{t('studentCard.answerChoices')}</p>
          <ul className="space-y-1.5">
            {view.options.map((option, index) => (
              <li
                key={index}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
                  option.chosen ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-muted'
                }`}
              >
                <span aria-hidden="true" className="w-4 shrink-0 font-semibold text-accent">
                  {option.chosen ? '●' : '○'}
                </span>
                <span className="whitespace-pre-wrap">{option.text}</span>
                {option.chosen && <span className="sr-only">{t('studentCard.answerChosen')}</span>}
              </li>
            ))}
          </ul>
          {view.missing > 0 && (
            <p className="mt-2 text-xs text-ink-muted">{t('studentCard.answerMissing', { n: view.missing })}</p>
          )}
        </div>
      );
    case 'lines':
      return (
        <div>
          <p className="mb-2 text-xs font-semibold text-ink-muted">{t('studentCard.answerLines')}</p>
          <CodeLines
            lines={view.lines.map((line) => ({
              text: line.text,
              indent: line.indent,
              note: line.distractor ? t('studentCard.answerDistractor') : undefined
            }))}
          />
          {view.missing > 0 && (
            <p className="mt-2 text-xs text-ink-muted">{t('studentCard.answerMissing', { n: view.missing })}</p>
          )}
        </div>
      );
    case 'unreadable':
      return <p className="text-sm text-ink-muted">{t('studentCard.answerUnreadable')}</p>;
  }
}
