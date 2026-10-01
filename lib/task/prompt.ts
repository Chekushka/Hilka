/**
 * A task prompt is plain text, with one piece of markup: a sample fenced in
 * ``` lines — expected output or a picture made of characters — is shown in
 * the code face with every space kept (components/task/PromptText.tsx).
 * Deliberately not Markdown: a prompt saying "a * b" must not turn italic.
 * An unclosed fence is left as literal text rather than guessed at.
 */

export type PromptPart = { kind: 'text'; text: string } | { kind: 'sample'; text: string };

const FENCE = /^[ \t]*```[\w-]*[ \t]*$/;

export function parsePrompt(prompt: string): PromptPart[] {
  const lines = prompt.split('\n');
  const parts: PromptPart[] = [];
  let text: string[] = [];

  const flushText = () => {
    const joined = text.join('\n').replace(/^\n+|\n+$/g, '');
    if (joined.trim() !== '') parts.push({ kind: 'text', text: joined });
    text = [];
  };

  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) {
      const close = lines.findIndex((line, at) => at > i && FENCE.test(line));
      if (close !== -1) {
        flushText();
        parts.push({ kind: 'sample', text: lines.slice(i + 1, close).join('\n') });
        i = close;
        continue;
      }
    }
    text.push(lines[i]);
  }
  flushText();
  return parts;
}

/** The prompt without its fence lines — for plain-text places like the downloaded .py file's comment. */
export function promptPlainText(prompt: string): string {
  return parsePrompt(prompt)
    .map((part) => part.text)
    .join('\n\n');
}
