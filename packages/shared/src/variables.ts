import { LIMITS } from './constants';

export const BUILTIN_VARIABLES = ['date', 'time', 'datetime', 'clipboard'] as const;
export type BuiltinVariable = (typeof BUILTIN_VARIABLES)[number];

const BUILTIN_SET: ReadonlySet<string> = new Set(BUILTIN_VARIABLES);
const VARIABLE_RE = /\{([a-zA-Z][a-zA-Z0-9_-]{0,31})\}/g;

export interface RenderContext {
  now: Date;
  locale?: string;
  /** Values typed by the user for custom variables, keyed by variable name. */
  values?: Readonly<Record<string, string>>;
  /** Clipboard text, only when the user enabled `{clipboard}` and granted permission. */
  clipboard?: string;
}

export function isBuiltinVariable(name: string): name is BuiltinVariable {
  return BUILTIN_SET.has(name);
}

/** Every variable referenced by a template, in order of first appearance. */
export function listVariables(content: string): string[] {
  const seen = new Set<string>();
  for (const m of content.matchAll(VARIABLE_RE)) {
    const name = m[1];
    if (name) seen.add(name);
  }
  return [...seen];
}

/** Variables the user must type a value for (anything that is not built in). */
export function listPromptVariables(content: string): string[] {
  return listVariables(content).filter((v) => !isBuiltinVariable(v));
}

export function usesClipboard(content: string): boolean {
  return listVariables(content).includes('clipboard');
}

/** `first_name` → `First name`. */
export function variableLabel(name: string): string {
  const spaced = name.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function formatDate(now: Date, locale?: string): string {
  return now.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatTime(now: Date, locale?: string): string {
  return now.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Replaces variables with values. Pure string substitution: user templates are
 * never evaluated as code. Unknown values become an empty string.
 */
export function renderTemplate(content: string, ctx: RenderContext): string {
  return content.replace(VARIABLE_RE, (_full, name: string) => {
    switch (name) {
      case 'date':
        return formatDate(ctx.now, ctx.locale);
      case 'time':
        return formatTime(ctx.now, ctx.locale);
      case 'datetime':
        return `${formatDate(ctx.now, ctx.locale)} ${formatTime(ctx.now, ctx.locale)}`;
      case 'clipboard':
        return (ctx.clipboard ?? '').slice(0, LIMITS.contentMax);
      default:
      {
        const values = ctx.values;
        const value = values && Object.hasOwn(values, name) ? values[name] : undefined;
        return typeof value === 'string' ? value.slice(0, LIMITS.variableValueMax) : '';
      }
    }
  });
}
