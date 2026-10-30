import { useState, type ReactNode } from 'react';
import { openCheckout } from '../lib/billing';
import { SnippetLimitError } from '../lib/storage';
import { ConfirmDialog } from './components';

/**
 * Runs a library change and, if it hits the Free snippet limit, shows an
 * upgrade dialog instead of failing silently. Other errors are rethrown.
 */
export function useLimitGuard(): [ReactNode, <T>(fn: () => Promise<T>) => Promise<T | undefined>] {
  const [hit, setHit] = useState<SnippetLimitError | null>(null);

  const guard = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof SnippetLimitError) {
        setHit(e);
        return undefined;
      }
      throw e;
    }
  };

  const node = hit && (
    <ConfirmDialog
      title="Snippet limit reached"
      body={
        <>
          The Free plan includes up to {hit.limit} snippets. Upgrade to Pro for unlimited snippets. Your existing snippets keep
          working.
        </>
      }
      confirmLabel="Upgrade to Pro"
      danger={false}
      onConfirm={() => {
        setHit(null);
        void openCheckout();
      }}
      onCancel={() => setHit(null)}
    />
  );
  return [node, guard];
}
