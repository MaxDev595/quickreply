import {
  createMatcher,
  isSiteExcluded,
  listPromptVariables,
  renderTemplate,
  usesClipboard,
  type MatchResult,
  type Matcher,
  type Settings,
  type Snippet,
} from '@quickreply/shared';
import { resolveEditable, type EditableTarget } from './fields';
import { insertRichText, replaceInField, selectBackwards } from './insert';
import { fieldTextBeforeCaret, getSelectionFor, richTextBeforeCaret } from './textAccess';
import { isPromptOpen, promptForVariables } from './variablePrompt';

export interface ExpanderDeps {
  hostname: string;
  readClipboard: () => Promise<string>;
  onExpanded: (snippetId: string) => void;
}

/**
 * Watches trusted `input` events, matches the few characters before the caret
 * against the user's shortcuts and replaces them. Typed text is inspected in
 * memory only (at most the longest shortcut length) and never stored or sent.
 */
export class Expander {
  private matcher: Matcher = createMatcher([], 'instant');
  private active = false;
  private busy = false;
  private clipboardEnabled = false;
  private readonly deps: ExpanderDeps;

  constructor(deps: ExpanderDeps) {
    this.deps = deps;
    this.onInput = this.onInput.bind(this);
  }

  start(): void {
    document.addEventListener('input', this.onInput, true);
  }

  stop(): void {
    document.removeEventListener('input', this.onInput, true);
  }

  update(snippets: Snippet[], settings: Settings): void {
    this.active = settings.enabled && !isSiteExcluded(this.deps.hostname, settings.excludedSites);
    this.matcher = createMatcher(snippets, settings.triggerMode);
    this.clipboardEnabled = settings.clipboardEnabled;
  }

  isActive(): boolean {
    return this.active;
  }

  private onInput(event: Event): void {
    if (!this.active || this.busy || !event.isTrusted || isPromptOpen()) return;
    if (!(event instanceof InputEvent) || event.isComposing || event.inputType !== 'insertText') return;
    const target = resolveEditable(event.composedPath()[0] ?? null);
    if (!target) return;

    const text = this.textBefore(target);
    if (!text) return;
    const match = this.matcher.match(text);
    if (match) void this.expand(target, match);
  }

  private textBefore(target: EditableTarget): string | null {
    const n = this.matcher.lookBehind;
    if (target.kind === 'field') return fieldTextBeforeCaret(target.el, n);
    return richTextBeforeCaret(target.el, getSelectionFor(target.root), n);
  }

  private async expand(target: EditableTarget, match: MatchResult): Promise<void> {
    const { snippet, removeLength, trailing } = match;
    const typed = snippet.shortcut + trailing;
    const prompts = listPromptVariables(snippet.content);

    // Capture exactly what to replace before anything async happens.
    let fieldRange: { start: number; end: number } | null = null;
    let richRange: Range | null = null;
    if (target.kind === 'field') {
      const end = target.el.selectionStart ?? 0;
      fieldRange = { start: end - removeLength, end };
      if (target.el.value.slice(fieldRange.start, end) !== typed) return;
    } else if (prompts.length > 0 || usesClipboard(snippet.content)) {
      const sel = getSelectionFor(target.root);
      if (!sel) return;
      richRange = selectBackwards(sel, typed);
      if (!richRange) return;
      sel.collapseToEnd();
    }

    let values: Record<string, string> = {};
    if (prompts.length > 0) {
      const anchor = this.anchorRect(target, richRange);
      const result = await promptForVariables({ title: snippet.name, shortcut: snippet.shortcut, variables: prompts, anchor });
      if (!result) {
        target.el.focus();
        return;
      }
      values = result;
    }
    const clipboard = this.clipboardEnabled && usesClipboard(snippet.content) ? await this.deps.readClipboard() : '';
    const output = renderTemplate(snippet.content, { now: new Date(), values, clipboard }) + trailing;

    this.busy = true;
    try {
      let ok: boolean;
      if (target.kind === 'field') ok = fieldRange ? this.replaceField(target.el, fieldRange, typed, output) : false;
      else ok = this.replaceRich(target, richRange, typed, output);
      if (ok) this.deps.onExpanded(snippet.id);
    } finally {
      this.busy = false;
    }
  }

  private replaceField(
    el: HTMLInputElement | HTMLTextAreaElement,
    range: { start: number; end: number },
    typed: string,
    output: string,
  ): boolean {
    el.focus();
    // The page may have changed the value while the prompt was open.
    if (el.value.slice(range.start, range.end) !== typed) return false;
    return replaceInField({ el, start: range.start, end: range.end }, output);
  }

  private replaceRich(target: Extract<EditableTarget, { kind: 'rich' }>, saved: Range | null, typed: string, output: string): boolean {
    const sel = getSelectionFor(target.root);
    if (!sel) return false;
    if (saved) {
      target.el.focus();
      if (saved.toString() !== typed) return false;
      sel.removeAllRanges();
      sel.addRange(saved);
    } else if (!selectBackwards(sel, typed)) {
      return false;
    }
    return insertRichText(output);
  }

  private anchorRect(target: EditableTarget, range: Range | null): DOMRect {
    const rect = range?.getBoundingClientRect();
    if (rect && (rect.width > 0 || rect.height > 0)) return rect;
    return target.el.getBoundingClientRect();
  }
}
