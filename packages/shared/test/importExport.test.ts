import { describe, expect, it } from 'vitest';
import { createExport, mergeImport, parseImport, replaceWithImport } from '../src/importExport';
import { createFolder, createSnippet } from '../src/library';

const lib = () => {
  const folder = createFolder('Support', 1, 'f1');
  return {
    folders: [folder],
    snippets: [
      createSnippet({ name: 'Hello', shortcut: '/hello', content: 'Hello!', folderId: 'f1' }, 1, 's1'),
      createSnippet({ name: 'Bye', shortcut: '/bye', content: 'Bye!' }, 1, 's2'),
    ],
  };
};

describe('export → import round trip', () => {
  it('restores the same data', () => {
    const text = JSON.stringify(createExport(lib()));
    const parsed = parseImport(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.data).toEqual(lib());
    expect(parsed.value.warnings).toEqual([]);
  });
});

describe('parseImport rejects broken files', () => {
  it.each([
    ['not json', '{oops'],
    ['array root', '[]'],
    ['wrong format', '{"format":"other","snippets":[]}'],
    ['wrong version', '{"format":"quickreply-backup","version":9,"snippets":[]}'],
    ['no snippets', '{"format":"quickreply-backup","version":1}'],
    ['only invalid snippets', '{"snippets":[{"shortcut":"a b","content":"x"}]}'],
  ])('%s', (_label, text) => {
    expect(parseImport(text).ok).toBe(false);
  });

  it('rejects oversized input', () => {
    expect(parseImport(' '.repeat(5 * 1024 * 1024 + 1)).ok).toBe(false);
  });
});

describe('parseImport sanitizes items', () => {
  it('skips invalid snippets with warnings and fills defaults', () => {
    const result = parseImport(
      JSON.stringify({
        snippets: [
          { shortcut: '/ok', content: 'fine' },
          { shortcut: '/x', content: 42 },
          'garbage',
          { id: 'bad id with spaces', shortcut: '/id', content: 'y', folderId: 'missing' },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { snippets } = result.value.data;
    expect(snippets.map((s) => s.shortcut)).toEqual(['/ok', '/id']);
    expect(snippets[0]).toMatchObject({ name: '/ok', enabled: true, favorite: false, folderId: null });
    expect(snippets[1]?.id).not.toBe('bad id with spaces');
    expect(snippets[1]?.folderId).toBeNull();
    expect(result.value.warnings).toHaveLength(2);
  });

  it('gives duplicate ids inside the file fresh ids', () => {
    const result = parseImport(
      JSON.stringify({ snippets: [{ id: 'a', shortcut: '/a', content: '1' }, { id: 'a', shortcut: '/b', content: '2' }] }),
    );
    expect(result.ok && new Set(result.value.data.snippets.map((s) => s.id)).size).toBe(2);
  });
});

describe('mergeImport conflict handling', () => {
  const incoming = {
    folders: [createFolder('support', 5, 'f-other'), createFolder('Sales', 5, 'f1')],
    snippets: [
      createSnippet({ name: 'Hello 2', shortcut: '/hello', content: 'Hi there', folderId: 'f-other' }, 5, 's1'),
      createSnippet({ name: 'New', shortcut: '/new', content: 'New one', folderId: 'f1' }, 5, 's9'),
    ],
  };

  it('renames conflicting shortcuts and re-ids clashing ids', () => {
    const { data, report } = mergeImport(lib(), incoming, 'rename');
    expect(report).toMatchObject({ added: 2, renamed: 1, skipped: 0, overwritten: 0, foldersAdded: 1 });
    expect(data.snippets.map((s) => s.shortcut)).toEqual(['/hello', '/bye', '/hello2', '/new']);
    expect(new Set(data.snippets.map((s) => s.id)).size).toBe(4);
    // "support" folder reused by name, "Sales" got a new id because f1 is taken
    const hello2 = data.snippets.find((s) => s.shortcut === '/hello2');
    expect(hello2?.folderId).toBe('f1');
    const sales = data.folders.find((f) => f.name === 'Sales');
    expect(sales?.id).not.toBe('f1');
    expect(data.snippets.find((s) => s.shortcut === '/new')?.folderId).toBe(sales?.id);
  });

  it('skips conflicts', () => {
    const { data, report } = mergeImport(lib(), incoming, 'skip');
    expect(report.skipped).toBe(1);
    expect(data.snippets.find((s) => s.shortcut === '/hello')?.content).toBe('Hello!');
  });

  it('overwrites conflicts but keeps the existing id', () => {
    const { data, report } = mergeImport(lib(), incoming, 'overwrite');
    expect(report.overwritten).toBe(1);
    const hello = data.snippets.find((s) => s.shortcut === '/hello');
    expect(hello).toMatchObject({ id: 's1', content: 'Hi there' });
    expect(data.snippets.filter((s) => s.shortcut === '/hello')).toHaveLength(1);
  });

  it('replace mode restores a backup and fixes duplicates inside it', () => {
    const dup = {
      folders: [],
      snippets: [
        createSnippet({ name: 'a', shortcut: '/a', content: '1' }, 1, 'a'),
        createSnippet({ name: 'b', shortcut: '/a', content: '2' }, 1, 'b'),
      ],
    };
    const { data } = replaceWithImport(dup);
    expect(data.snippets.map((s) => s.shortcut)).toEqual(['/a', '/a2']);
  });
});
