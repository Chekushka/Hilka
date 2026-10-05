import { parsePrompt } from '@/lib/task/prompt';

/**
 * A task prompt: text as written (line breaks kept), and any ```-fenced
 * sample in the code face with every space kept, so output to reproduce —
 * a picture made of characters above all — looks exactly as it must be
 * printed (lib/task/prompt.ts).
 *
 * `noCopy` is for a retype task (lib/task/tags.ts): the sample
 * is the code to type out, so it cannot be selected — copying it would skip the
 * whole exercise. A nudge, not a lock: nothing stops a determined student.
 */
export function PromptText({
  prompt,
  className = '',
  noCopy = false
}: {
  prompt: string;
  className?: string;
  noCopy?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {parsePrompt(prompt).map((part, index) =>
        part.kind === 'text' ? (
          <p key={index} className="whitespace-pre-line">
            {part.text}
          </p>
        ) : (
          <pre
            key={index}
            className={`w-fit max-w-full overflow-x-auto rounded-lg bg-code-bg px-4 py-3 font-mono text-[0.95rem] leading-snug text-ink ${
              noCopy ? 'select-none' : ''
            }`}
            data-no-copy={noCopy || undefined}
            onCopy={noCopy ? (event) => event.preventDefault() : undefined}
          >
            {part.text}
          </pre>
        )
      )}
    </div>
  );
}
