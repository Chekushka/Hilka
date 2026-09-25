'use client';

/**
 * CodeMirror 6, configured down rather than up. The workspace is a tool, not a
 * game: no autocomplete popups, no linting squiggles, no bracket-match
 * animation. A student who did not choose to learn programming does not need
 * an IDE arguing with them while they type.
 *
 * The failing line is marked with a calm background, never a red squiggle.
 */
import { useEffect, useRef } from 'react';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { indentUnit } from '@codemirror/language';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, keymap, lineNumbers, type DecorationSet } from '@codemirror/view';

const setErrorLine = StateEffect.define<number | null>();

const errorLineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, transaction) {
    let next = decorations.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(setErrorLine)) continue;
      const line = effect.value;
      if (line === null || line < 1 || line > transaction.state.doc.lines) {
        next = Decoration.none;
      } else {
        const at = transaction.state.doc.line(line);
        next = Decoration.set([
          Decoration.line({ class: 'cm-attention-line' }).range(at.from)
        ]);
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field)
});

const theme = EditorView.theme({
  '&': { fontSize: '14px', backgroundColor: 'var(--code-bg)', color: 'var(--ink)' },
  '&.cm-focused': { outline: '2px solid var(--accent)', outlineOffset: '-2px' },
  // The caret is the browser's native one (no drawSelection), and CodeMirror's
  // base theme pins it black for an editor not flagged dark — invisible on the
  // dark code background. The ink token flips with the theme.
  '.cm-content': { fontFamily: 'var(--font-code)', padding: '10px 0', caretColor: 'var(--ink)' },
  '.cm-gutters': {
    backgroundColor: 'var(--code-bg)',
    color: 'var(--ink-muted)',
    border: 'none',
    fontFamily: 'var(--font-code)'
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-attention-line': {
    // Never red: a wrong answer is not a failure, and a class of 25 contains
    // someone who cannot separate red from green anyway.
    backgroundColor: 'color-mix(in srgb, var(--attention) 18%, transparent)',
    boxShadow: 'inset 3px 0 0 0 var(--attention)'
  }
});

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  errorLine?: number | null;
  readOnly?: boolean;
  ariaLabel: string;
}

export function CodeEditor({ value, onChange, errorLine = null, readOnly = false, ariaLabel }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  // The editor is created once and keeps its own document, so the change
  // handler is reached through a ref rather than rebuilding the view.
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        python(),
        indentUnit.of('    '),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        errorLineField,
        theme,
        EditorView.lineWrapping,
        EditorState.readOnly.of(readOnly),
        EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        })
      ]
    });
    const editor = new EditorView({ state, parent: host.current });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // Mounted once: the document is owned by CodeMirror from here on, and
    // recreating it on every keystroke would lose the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    view.current?.dispatch({ effects: setErrorLine.of(errorLine) });
  }, [errorLine]);

  return <div ref={host} className="overflow-hidden rounded-md border border-line" />;
}
