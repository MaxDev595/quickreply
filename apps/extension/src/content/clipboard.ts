/**
 * Reading the clipboard for the {clipboard} variable.
 *
 * In a content script, navigator.clipboard.readText() is checked against the
 * *page's* clipboard permission, not the extension's optional `clipboardRead`
 * permission, so on real sites it usually fails silently. The path Chrome
 * documents for extensions holding `clipboardRead` is document.execCommand('paste')
 * into a temporary textarea. That is tried first; readText() is a fallback.
 *
 * The temporary textarea is removed immediately. The caller restores focus and
 * the selection in the field afterwards (the expander saved the exact range).
 */
export function pasteViaExecCommand(): string | null {
  const ta = document.createElement('textarea');
  ta.setAttribute('aria-hidden', 'true');
  ta.setAttribute('tabindex', '-1');
  ta.setAttribute('data-quickreply-ignore', '');
  ta.style.cssText = 'position:fixed;top:0;left:-10000px;width:1px;height:1px;opacity:0;pointer-events:none;';
  // Keep the page's own paste handlers from seeing this internal paste.
  const stop = (e: Event) => e.stopImmediatePropagation();
  ta.addEventListener('paste', stop);
  ta.addEventListener('input', stop);
  ta.addEventListener('beforeinput', stop);
  document.documentElement.append(ta);
  try {
    ta.focus({ preventScroll: true });
    const ok = document.execCommand('paste');
    return ok ? ta.value : null;
  } catch {
    return null;
  } finally {
    ta.remove();
  }
}

export async function readClipboard(): Promise<string> {
  const pasted = pasteViaExecCommand();
  if (pasted !== null) return pasted;
  try {
    return await navigator.clipboard.readText();
  } catch {
    // No permission or page not focused: insert nothing rather than fail.
    return '';
  }
}
