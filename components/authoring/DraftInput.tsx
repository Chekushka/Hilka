'use client';

/**
 * An input that keeps what the author typed while it does not parse yet ("3,"
 * on the way to "3,5", "0, " on the way to "0, 2"), and commits only once it
 * does. When the committed value changes from outside (a row moved, JSON
 * edited), the draft follows — unless the draft already means that value, so
 * a decimal comma is never rewritten into a dot under the author's cursor.
 */
import { useState } from 'react';

interface DraftInputProps {
  id?: string;
  /** The committed value, as text. */
  text: string;
  /** Parses and commits `draft`; returns the committed value as text, or null when it does not parse. */
  commit: (draft: string) => string | null;
  multiline?: boolean;
  rows?: number;
  mono?: boolean;
  className?: string;
  placeholder?: string;
  invalidMessage?: string;
  ariaLabel?: string;
}

export function DraftInput({
  id,
  text,
  commit,
  multiline = false,
  rows = 3,
  mono = false,
  className = '',
  placeholder,
  invalidMessage,
  ariaLabel
}: DraftInputProps) {
  const [draft, setDraft] = useState(text);
  const [seen, setSeen] = useState(text);
  const [invalid, setInvalid] = useState(false);

  if (text !== seen) {
    setSeen(text);
    // Keep the draft if it already says the same thing in the author's own spelling.
    if (draft !== text) {
      setDraft(text);
      setInvalid(false);
    }
  }

  function handleChange(next: string) {
    setDraft(next);
    const committed = commit(next);
    setInvalid(committed === null);
    if (committed !== null) setSeen(committed);
  }

  const base = `rounded-md border bg-surface px-3 py-1.5 text-sm text-ink ${
    invalid ? 'border-attention' : 'border-line'
  } ${mono ? 'bg-code-bg font-mono' : ''} ${className}`;

  return (
    <>
      {multiline ? (
        <textarea
          id={id}
          rows={rows}
          value={draft}
          onChange={(event) => handleChange(event.target.value)}
          spellCheck={false}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          className={base}
        />
      ) : (
        <input
          id={id}
          value={draft}
          onChange={(event) => handleChange(event.target.value)}
          spellCheck={false}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          className={base}
        />
      )}
      {invalid && invalidMessage && <span className="text-xs text-attention">{invalidMessage}</span>}
    </>
  );
}
