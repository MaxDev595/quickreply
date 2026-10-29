/** Field detection: which elements QuickReply may touch, and which it must never touch. */

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'email', '']);

const SENSITIVE_AUTOCOMPLETE = /\b(cc-|current-password|new-password|one-time-code|transaction-)/i;
const SENSITIVE_NAME =
  /(pass(word|wd|code)|\bpwd\b|\bcvv\b|\bcvc\b|\bcsc\b|card.?(num|number)|\bcc.?num|\biban\b|routing.?number|\bssn\b|social.?security|\botp\b|\b2fa\b|\bpin\b|secret|api.?key|access.?token)/i;

export type EditableTarget =
  | { kind: 'field'; el: HTMLInputElement | HTMLTextAreaElement }
  | { kind: 'rich'; el: HTMLElement; root: Document | ShadowRoot };

export function isSensitive(el: Element): boolean {
  if (el instanceof HTMLInputElement && el.type === 'password') return true;
  const autocomplete = el.getAttribute('autocomplete') ?? '';
  if (SENSITIVE_AUTOCOMPLETE.test(autocomplete)) return true;
  const hints = [el.getAttribute('name'), el.id, el.getAttribute('aria-label'), el.getAttribute('placeholder')]
    .filter(Boolean)
    .join(' ');
  if (SENSITIVE_NAME.test(hints)) return true;
  return el.closest('[data-quickreply-ignore]') !== null;
}

/** Topmost contenteditable host that contains `el`. */
function editableHost(el: HTMLElement): HTMLElement {
  let host = el;
  while (host.parentElement?.isContentEditable) host = host.parentElement;
  return host;
}

export function resolveEditable(target: EventTarget | null): EditableTarget | null {
  if (!(target instanceof Element)) return null;
  if (target instanceof HTMLTextAreaElement) {
    if (target.readOnly || target.disabled || isSensitive(target)) return null;
    return { kind: 'field', el: target };
  }
  if (target instanceof HTMLInputElement) {
    if (!TEXT_INPUT_TYPES.has(target.type) || target.readOnly || target.disabled || isSensitive(target)) return null;
    return { kind: 'field', el: target };
  }
  if (target instanceof HTMLElement && target.isContentEditable) {
    const host = editableHost(target);
    if (isSensitive(host)) return null;
    const root = host.getRootNode();
    return { kind: 'rich', el: host, root: root instanceof ShadowRoot ? root : document };
  }
  return null;
}
