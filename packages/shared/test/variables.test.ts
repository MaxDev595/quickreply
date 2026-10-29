import { describe, expect, it } from 'vitest';
import {
  listPromptVariables,
  listVariables,
  renderTemplate,
  usesClipboard,
  variableLabel,
} from '../src/variables';

const now = new Date(2026, 9, 29, 14, 5);

describe('template variables', () => {
  it('lists variables in order without duplicates', () => {
    expect(listVariables('Hi {name}, {date}. Bye {name}')).toEqual(['name', 'date']);
  });

  it('only asks the user for non-builtin variables', () => {
    expect(listPromptVariables('Hello {name} from {company} on {date} {clipboard}')).toEqual(['name', 'company']);
  });

  it('renders date, time and custom values', () => {
    const out = renderTemplate('Hello {name}! Today is {date} at {time}.', {
      now,
      locale: 'en-US',
      values: { name: 'Ana' },
    });
    expect(out).toBe('Hello Ana! Today is Oct 29, 2026 at 2:05 PM.');
  });

  it('renders datetime', () => {
    expect(renderTemplate('{datetime}', { now, locale: 'en-US' })).toBe('Oct 29, 2026 2:05 PM');
  });

  it('leaves non-variable braces untouched (e.g. JSON or code)', () => {
    const json = '{ "a": 1 } {not valid} {1abc}';
    expect(renderTemplate(json, { now })).toBe(json);
  });

  it('never evaluates code inside templates', () => {
    const out = renderTemplate('{constructor} {__proto__} {toString}', { now, values: {} });
    // `{__proto__}` is not a valid variable name, so it stays literal text.
    expect(out).toBe(' {__proto__} ');
  });

  it('uses empty clipboard when not provided', () => {
    expect(usesClipboard('paste: {clipboard}')).toBe(true);
    expect(renderTemplate('[{clipboard}]', { now })).toBe('[]');
    expect(renderTemplate('[{clipboard}]', { now, clipboard: 'x' })).toBe('[x]');
  });

  it('keeps multiline content', () => {
    expect(renderTemplate('Line 1\nLine 2 {name}', { now, values: { name: 'Z' } })).toBe('Line 1\nLine 2 Z');
  });

  it('builds readable labels', () => {
    expect(variableLabel('first_name')).toBe('First name');
    expect(variableLabel('companyName')).toBe('Company name');
  });
});
