import { LIMITS, variableLabel } from '@quickreply/shared';

/**
 * Compact fill-in form for custom variables like {name}. Rendered in a closed
 * Shadow DOM so the page can't read or restyle it; built only with
 * createElement/textContent (no innerHTML).
 */

const STYLE = `
:host { all: initial; }
.qr-card {
  position: fixed; z-index: 2147483647; width: 300px; box-sizing: border-box;
  font: 13px/1.4 "Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #111827; background: #fff; border: 1px solid #E5E7EB; border-radius: 12px;
  box-shadow: 0 1px 2px rgba(17,24,39,.06), 0 12px 32px -8px rgba(17,24,39,.22);
  padding: 14px;
}
.qr-head { display: flex; align-items: baseline; gap: 8px; margin: 0 0 10px; }
.qr-title { font-weight: 600; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qr-key { font-size: 12px; color: #64748B; border: 1px solid #E5E7EB; border-bottom-width: 2px; border-radius: 6px; padding: 0 6px; }
label { display: block; font-size: 12px; color: #64748B; margin: 8px 0 4px; }
input {
  box-sizing: border-box; width: 100%; font: inherit; color: inherit; background: #F8FAFC;
  border: 1px solid #E5E7EB; border-radius: 8px; padding: 7px 9px; outline: none;
}
input:focus { border-color: #16A34A; box-shadow: 0 0 0 3px rgba(22,163,74,.18); background: #fff; }
.qr-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
button { font: inherit; font-weight: 500; border-radius: 8px; padding: 6px 12px; cursor: pointer; border: 1px solid #E5E7EB; background: #fff; color: #111827; }
button:focus-visible { outline: 2px solid #16A34A; outline-offset: 2px; }
.qr-primary { background: #16A34A; border-color: #16A34A; color: #fff; }
.qr-primary:hover { background: #15803D; }
.qr-hint { font-size: 11px; color: #64748B; margin-top: 10px; }
@media (prefers-color-scheme: dark) {
  .qr-card { color: #E6EAF0; background: #161B22; border-color: #2A323D; box-shadow: 0 12px 32px -8px rgba(0,0,0,.6); }
  .qr-key { color: #8B95A5; border-color: #2A323D; }
  label, .qr-hint { color: #8B95A5; }
  input { background: #0E1116; border-color: #2A323D; }
  input:focus { background: #0E1116; border-color: #22C55E; box-shadow: 0 0 0 3px rgba(34,197,94,.2); }
  button { background: #161B22; color: #E6EAF0; border-color: #2A323D; }
  .qr-primary { background: #22C55E; border-color: #22C55E; color: #06210F; }
  .qr-primary:hover { background: #16A34A; }
}
`;

export interface PromptOptions {
  title: string;
  shortcut: string;
  variables: string[];
  anchor: DOMRect;
}

let openPrompt: (() => void) | null = null;

export function isPromptOpen(): boolean {
  return openPrompt !== null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Resolves with the entered values, or `null` if the user cancelled. */
export function promptForVariables({ title, shortcut, variables, anchor }: PromptOptions): Promise<Record<string, string> | null> {
  openPrompt?.();
  return new Promise((resolve) => {
    const host = document.createElement('quickreply-prompt');
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = STYLE;

    const card = el('form', 'qr-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', `Fill in ${title}`);
    const head = el('div', 'qr-head');
    head.append(el('span', 'qr-title', title), el('span', 'qr-key', shortcut));
    card.append(head);

    const inputs = variables.map((name, i) => {
      const id = `qr-var-${i}`;
      const label = el('label', undefined, variableLabel(name));
      label.htmlFor = id;
      const input = el('input');
      input.id = id;
      input.maxLength = LIMITS.variableValueMax;
      input.autocomplete = 'off';
      input.spellcheck = true;
      card.append(label, input);
      return input;
    });

    const actions = el('div', 'qr-actions');
    const cancel = el('button', undefined, 'Cancel');
    cancel.type = 'button';
    const submit = el('button', 'qr-primary', 'Insert');
    submit.type = 'submit';
    actions.append(cancel, submit);
    card.append(actions, el('div', 'qr-hint', 'Press Enter to insert, Esc to cancel.'));

    // Position below the caret/field, kept inside the viewport.
    const top = anchor.bottom + 8 + 260 > window.innerHeight ? Math.max(8, anchor.top - 8 - 40 - variables.length * 56) : anchor.bottom + 8;
    card.style.top = `${Math.round(top)}px`;
    card.style.left = `${Math.round(Math.min(Math.max(8, anchor.left), window.innerWidth - 308))}px`;

    shadow.append(style, card);
    document.documentElement.append(host);

    let done = false;
    const finish = (value: Record<string, string> | null) => {
      if (done) return;
      done = true;
      openPrompt = null;
      document.removeEventListener('mousedown', onOutside, true);
      host.remove();
      resolve(value);
    };
    const onOutside = (e: MouseEvent) => {
      if (!e.composedPath().includes(host)) finish(null);
    };
    openPrompt = () => finish(null);

    card.addEventListener('submit', (e) => {
      e.preventDefault();
      finish(Object.fromEntries(variables.map((name, i) => [name, inputs[i]?.value ?? ''])));
    });
    card.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(null);
      }
    });
    // Keep page shortcuts (e.g. Gmail's) from reacting to typing inside the form.
    for (const type of ['keyup', 'keypress', 'input', 'beforeinput'] as const) {
      card.addEventListener(type, (e) => e.stopPropagation());
    }
    cancel.addEventListener('click', () => finish(null));
    document.addEventListener('mousedown', onOutside, true);
    inputs[0]?.focus();
  });
}
