'use client';

import { createMatcher, createSnippet, renderTemplate } from '@quickreply/shared';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Keycap } from './brand';

/**
 * A working text field powered by the same matching engine as the extension
 * (@quickreply/shared). Type a shortcut, or click one to watch it expand.
 */
const DEMO_SNIPPETS = [
  { shortcut: '/hello', content: 'Hello! Thank you for contacting us. How can I help you today?' },
  { shortcut: '/pricing', content: 'Our plans start at $19 per month. Let me know if you’d like more details!' },
  { shortcut: '/thanks', content: 'Thanks for your patience! I’ve passed this on to the team and will follow up today, {date}.' },
  { shortcut: '/sig', content: 'Best regards,\nSam Rivera\nCustomer Success' },
];

export function LiveDemo() {
  const snippets = useMemo(
    () => DEMO_SNIPPETS.map((s, i) => createSnippet({ name: s.shortcut, shortcut: s.shortcut, content: s.content }, 0, `demo-${i}`)),
    [],
  );
  const matcher = useMemo(() => createMatcher(snippets, 'instant'), [snippets]);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('');
  const [typing, setTyping] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null);
  const userTouched = useRef(false);
  const timers = useRef<number[]>([]);

  useLayoutEffect(() => {
    if (caret.current !== null && ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [value]);

  /** Applies a new value and expands a shortcut that ends at `pos`. */
  const apply = useCallback(
    (next: string, pos: number) => {
      const match = matcher.match(next.slice(Math.max(0, pos - matcher.lookBehind), pos));
      if (!match) {
        setValue(next);
        caret.current = pos;
        return;
      }
      const expansion = renderTemplate(match.snippet.content, { now: new Date(), locale: 'en-US' }) + match.trailing;
      const start = pos - match.removeLength;
      setValue(next.slice(0, start) + expansion + next.slice(pos));
      caret.current = start + expansion.length;
      setStatus(`${match.snippet.shortcut} expanded to ${expansion.length} characters`);
    },
    [matcher],
  );

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  /** Types a shortcut character by character at the end of the text. */
  const playShortcut = useCallback(
    (shortcut: string) => {
      clearTimers();
      setTyping(true);
      const el = ref.current;
      let text = el?.value ?? '';
      if (text && !/\s$/.test(text)) text += ' ';
      [...shortcut].forEach((ch, i) => {
        timers.current.push(
          window.setTimeout(() => {
            text += ch;
            const done = i === shortcut.length - 1;
            if (done) {
              apply(text, text.length);
              setTyping(false);
            } else {
              setValue(text);
              caret.current = text.length;
            }
          }, 90 * (i + 1)),
        );
      });
    },
    [apply],
  );

  // One short autoplay so first-time visitors see what happens.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!userTouched.current) playShortcut('/hello');
    }, 1100);
    return () => {
      window.clearTimeout(t);
      clearTimers();
    };
  }, [playShortcut]);

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgb(17_24_39/0.04),0_24px_48px_-24px_rgb(17_24_39/0.25)]">
        <div className="flex items-center gap-1.5 border-b border-line bg-bg-alt px-4 py-3">
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="ml-3 text-[13px] font-medium text-muted">New message</span>
        </div>
        <dl className="divide-y divide-line border-b border-line text-[14px]">
          <div className="flex gap-3 px-5 py-2.5">
            <dt className="w-14 text-muted">To</dt>
            <dd>jordan@northwind.example</dd>
          </div>
          <div className="flex gap-3 px-5 py-2.5">
            <dt className="w-14 text-muted">Subject</dt>
            <dd>Re: Question about plans</dd>
          </div>
        </dl>
        <label htmlFor="demo-body" className="sr-only">
          Message. Type a shortcut such as /hello
        </label>
        <textarea
          id="demo-body"
          ref={ref}
          value={value}
          rows={7}
          spellCheck={false}
          placeholder="Type /hello here…"
          onFocus={() => {
            userTouched.current = true;
          }}
          onChange={(e) => {
            userTouched.current = true;
            clearTimers();
            setTyping(false);
            const native = e.nativeEvent as InputEvent;
            const pos = e.target.selectionStart;
            if (native.inputType === 'insertText') apply(e.target.value, pos);
            else {
              setValue(e.target.value);
            }
          }}
          className="block min-h-[188px] w-full resize-none px-5 py-4 text-[15px] leading-relaxed text-fg outline-none placeholder:text-faint"
        />
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3.5">
          <span className="mr-1 text-[13px] text-muted">Try a shortcut:</span>
          {DEMO_SNIPPETS.map((s) => (
            <button
              key={s.shortcut}
              type="button"
              disabled={typing}
              onClick={() => {
                userTouched.current = true;
                playShortcut(s.shortcut);
              }}
              className="rounded-md transition-transform hover:-translate-y-px active:translate-y-px disabled:opacity-60"
              aria-label={`Type ${s.shortcut}`}
            >
              <Keycap>{s.shortcut}</Keycap>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              clearTimers();
              setTyping(false);
              setValue('');
              setStatus('');
              ref.current?.focus();
            }}
            className="ml-auto text-[13px] font-medium text-muted hover:text-fg"
          >
            Clear
          </button>
        </div>
      </div>
      <p aria-live="polite" className="mt-3 h-5 text-center text-[13px] text-muted">
        {status}
      </p>
    </div>
  );
}
