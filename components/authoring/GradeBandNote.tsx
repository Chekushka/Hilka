/**
 * In the session builder, for graded lessons and homework: how Hilka suggests
 * a grade (docs/AI_CONTEXT.md, "Grading"; docs/HOMEWORK.md, sections 4 and 4a),
 * and above all why it can stop at 9 — the 10–12 band needs a fully solved
 * difficulty 4–5 task, on its first Check in homework, and a class check
 * never raises anything. Warns, without blocking, when the chosen tasks cannot
 * open the band at all. The numbers come from the grading config.
 */
import { DEFAULT_GRADING } from '@/lib/grading/config';
import { t } from '@/lib/i18n';

const percent = (share: number) => Math.round(share * 100);

interface GradeBandNoteProps {
  homework: boolean;
  /** Some chosen task is difficult enough to open the 10–12 band (`sessionAllowsHighBand`). */
  highBandReachable: boolean;
  /** Nothing chosen yet: no warning, only the explanation. */
  hasTasks: boolean;
}

export function GradeBandNote({ homework, highBandReachable, hasTasks }: GradeBandNoteProps) {
  const config = DEFAULT_GRADING;
  const values = {
    cap: config.highBandCap,
    hard: config.highBandMinDifficulty,
    hint: percent(config.hintCredit),
    fix: percent(config.fixCredit),
    p1: config.pointsByDifficulty[1],
    p3: config.pointsByDifficulty[3],
    p5: config.pointsByDifficulty[5]
  };
  const points = homework
    ? ['gradeNotePoints', 'gradeNoteHighBand', 'gradeNoteHomeworkFirst', 'gradeNoteImprovement', 'gradeNoteCheck', 'gradeNoteHints']
    : ['gradeNotePoints', 'gradeNoteHighBand', 'gradeNoteLessonFirst', 'gradeNoteHints'];

  return (
    <div className="flex flex-col gap-2" data-testid="grade-band-note">
      {hasTasks && !highBandReachable && (
        <p role="status" className="rounded-lg border border-attention p-3 text-sm text-ink" data-testid="grade-band-warning">
          {t('sessionBuilder.gradeNoHardWarning', values)}
        </p>
      )}
      <details className="rounded-lg border border-line">
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-ink">
          {t('sessionBuilder.gradeNoteTitle', values)}
        </summary>
        <ul className="flex list-disc flex-col gap-1.5 border-t border-line py-3 pr-3 pl-7 text-xs leading-relaxed text-ink">
          {points.map((key) => (
            <li key={key}>{t(`sessionBuilder.${key}`, values)}</li>
          ))}
          <li className="text-ink-muted">{t('sessionBuilder.gradeNoteTeacher')}</li>
        </ul>
      </details>
    </div>
  );
}
