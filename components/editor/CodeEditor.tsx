'use client';

/**
 * CodeMirror 6, configured down rather than up. The workspace is a tool, not a
 * game: no autocomplete popups, no linting squiggles, no bracket-match
 * animation. A student who did not choose to learn programming does not need
 * an IDE arguing with them while they type.
 *
 * The failing line is marked with a calm background, never a red squiggle.
 * The line whose `input()` is waiting gets the accent instead.
 *
 * `fill` is the student workspace's variant (components/task/CodePane.tsx): it
 * takes the whole code pane, no box of its own, and sets code larger — the
 * teacher projects this screen and the back row has to read it. `boxed`
 * stays the authoring forms' compact editor.
 *
 * On a touch screen the `fill` variant adds a key bar above the code: a phone
 * keyboard has no Tab, and Python cannot be written without indentation, and
 * the brackets, colon and quotes sit two layers deep in its symbol pages.
 * The keys never take the focus, so the on-screen keyboard stays open.
 */
import { useEffect, useRef, type PointerEvent, type RefObject } from 'react';
import { defaultKeymap, history, historyKeymap, indentLess, indentMore, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { indentUnit } from '@codemirror/language';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, keymap, lineNumbers, type DecorationSet } from '@codemirror/view';
import { t } from '@/lib/i18n';

/** One highlighted line, moved or cleared by its effect; `null` clears it. */
function lineHighlight(className: string) {
  const set = StateEffect.define<number | null>();
  const field = StateField.define<DecorationSet>({
    create() {
      return Decoration.none;
    },
    update(decorations, transaction) {
      let next = decorations.map(transaction.changes);
      for (const effect of transaction.effects) {
        if (!effect.is(set)) continue;
        const line = effect.value;
        if (line === null || line < 1 || line > transaction.state.doc.lines) {
          next = Decoration.none;
        } else {
          const at = transaction.state.doc.line(line);
          next = Decoration.set([Decoration.line({ class: className }).range(at.from)]);
        }
      }
      return next;
    },
    provide: (field) => EditorView.decorations.from(field)
  });
  return { set, field };
}

const errorLine = lineHighlight('cm-attention-line');
const inputLine = lineHighlight('cm-input-line');

const theme = EditorView.theme({
  '&': { fontSize: '14px', backgroundColor: 'var(--code-bg)', color: 'var(--ink)' },
  '&.cm-fill': { fontSize: '16px', height: '100%' },
  '&.cm-fill .cm-scroller': { lineHeight: '1.7' },
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
  },
  // The line whose input() is waiting: the accent, not the attention colour,
  // because nothing is wrong — the program is asking a question.
  '.cm-input-line': {
    backgroundColor: 'var(--accent-soft)',
    boxShadow: 'inset 3px 0 0 0 var(--accent)'
  }
});

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  errorLine?: number | null;
  /** The line whose `input()` a running program is waiting in. */
  inputLine?: number | null;
  readOnly?: boolean;
  ariaLabel: string;
  variant?: 'boxed' | 'fill';
}

export function CodeEditor({
  value,
  onChange,
  errorLine: errorLineNumber = null,
  inputLine: inputLineNumber = null,
  readOnly = false,
  ariaLabel,
  variant = 'boxed'
}: CodeEditorProps) {
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
        errorLine.field,
        inputLine.field,
        theme,
        EditorView.lineWrapping,
        EditorState.readOnly.of(readOnly),
        EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
        EditorView.editorAttributes.of({ class: variant === 'fill' ? 'cm-fill' : '' }),
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
    view.current?.dispatch({ effects: errorLine.set.of(errorLineNumber) });
  }, [errorLineNumber]);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const effects: StateEffect<unknown>[] = [inputLine.set.of(inputLineNumber)];
    // On a phone the line can be off screen while the answer field has the focus.
    if (inputLineNumber !== null && inputLineNumber >= 1 && inputLineNumber <= editor.state.doc.lines) {
      effects.push(EditorView.scrollIntoView(editor.state.doc.line(inputLineNumber).from, { y: 'nearest' }));
    }
    editor.dispatch({ effects });
  }, [inputLineNumber]);

  if (variant === 'boxed') {
    return <div ref={host} className="overflow-hidden rounded-md border border-line" />;
  }
  return (
    <>
      {!readOnly && <KeyBar view={view} />}
      <div ref={host} className="min-h-0 flex-1 overflow-hidden" />
    </>
  );
}

const SYMBOLS = [':', '(', ')', '"', "'", '=', '[', ']', '{', '}', ',', '_', '+', '-', '*', '/', '<', '>', '#'];

const keyClass =
  'flex h-10 min-w-10 flex-none items-center justify-center rounded-md border border-line bg-surface px-2.5 font-mono text-base text-ink active:bg-accent-soft';

/** Touch screens only (`pointer: coarse`): indent, outdent, and the symbols a phone hides. */
function KeyBar({ view }: { view: RefObject<EditorView | null> }) {
  function press(action: (editor: EditorView) => void) {
    const editor = view.current;
    if (!editor) return;
    action(editor);
    editor.focus();
  }
  // Keeping the focus in the editor keeps the phone's keyboard open.
  const keepFocus = (event: PointerEvent) => event.preventDefault();
  return (
    <div
      role="toolbar"
      aria-label={t('editor.keyBar')}
      className="hidden flex-none gap-1.5 overflow-x-auto border-b border-line bg-bg px-3 py-2 pointer-coarse:flex"
    >
      <button type="button" onPointerDown={keepFocus} onClick={() => press(indentMore)} aria-label={t('editor.indent')} className={keyClass}>
        ⇥
      </button>
      <button type="button" onPointerDown={keepFocus} onClick={() => press(indentLess)} aria-label={t('editor.outdent')} className={keyClass}>
        ⇤
      </button>
      {SYMBOLS.map((symbol) => (
        <button
          key={symbol}
          type="button"
          onPointerDown={keepFocus}
          onClick={() => press((editor) => editor.dispatch(editor.state.replaceSelection(symbol)))}
          aria-label={t('editor.insert', { symbol })}
          className={keyClass}
        >
          {symbol}
        </button>
      ))}
    </div>
  );
}
