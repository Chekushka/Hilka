import { parsePrompt } from '@/lib/task/prompt';

/**
 * A task prompt: text as written (line breaks kept), and any ```-fenced
 * sample in the code face with every space kept, so output to reproduce —
 * a picture made of characters above all — looks exactly as it must be
 * printed (lib/task/prompt.ts).
 */
export function PromptText({ prompt, className = '' }: { prompt: string; className?: string }) {
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
            className="w-fit max-w-full overflow-x-auto rounded-lg bg-code-bg px-4 py-3 font-mono text-[0.95rem] leading-snug text-ink"
          >
            {part.text}
          </pre>
        )
      )}
    </div>
  );
}
