import type { SnippetDraft } from '@quickreply/shared';

/** Optional starter snippets offered on the empty state. Never added automatically. */
export function exampleSnippets(prefix: string): SnippetDraft[] {
  return [
    {
      name: 'Greeting',
      shortcut: `${prefix}hello`,
      content: 'Hello! Thank you for contacting us. How can I help you today?',
    },
    {
      name: 'Follow-up',
      shortcut: `${prefix}followup`,
      content: 'Hi {name},\n\nJust following up on my last message. Let me know if you have any questions.\n\nBest regards',
    },
    {
      name: 'Today’s date',
      shortcut: `${prefix}today`,
      content: '{date}',
    },
  ];
}
