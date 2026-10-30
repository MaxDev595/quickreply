import { PLANS, type Entitlement } from '@quickreply/shared';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { activateLicense, cachedEntitlement, checkoutUrl, refreshEntitlement } from '../lib/billing';
import { Button, inputClass } from '../ui/components';

/** Plan & billing (test-mode builds only). */
export function PlanSection({ onToast }: { onToast: (m: string) => void }) {
  const [ent, setEnt] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEnt(await refreshEntitlement());
    } catch (e) {
      setError(`Couldn’t reach the billing server: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cachedEntitlement().then((c) => c && setEnt(c), () => undefined);
    // Syncing with the billing server (an external system) is what this effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // Re-check when the user comes back from the checkout tab.
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const activate = async () => {
    setError(null);
    try {
      const next = await activateLicense(key);
      setEnt(next);
      setKey('');
      onToast(`${PLANS[next.plan].name} activated`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const paid = ent && ent.tier !== 'free';
  return (
    <div className="flex flex-col gap-4">
      {ent?.testMode && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Test mode: payments use TON testnet. Paid features are still in development.
        </p>
      )}
      <div className="flex items-center justify-between gap-4 rounded-lg border border-line p-4">
        <div>
          <div className="text-[14px] font-semibold" data-testid="current-plan">
            {ent ? PLANS[ent.plan].name : 'Free'}
            {paid && ent.seats > 1 ? ` · ${ent.seats} seats` : ''}
          </div>
          <div className="mt-0.5 text-[12px] text-muted">
            {paid && ent.expiresAt ? `Active until ${new Date(ent.expiresAt).toLocaleDateString()}` : 'All local features, no limits.'}
          </div>
          {paid && ent.licenseKey && <div className="mt-1 font-mono text-[12px] text-muted">{ent.licenseKey}</div>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading} aria-label="Refresh plan">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={async () => {
              const url = await checkoutUrl();
              chrome.tabs.create({ url }).catch(() => window.open(url, '_blank'));
            }}
          >
            {paid ? 'Extend or change plan' : 'Upgrade'} <ExternalLink size={13} />
          </Button>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && key && void activate()}
          placeholder="QR-XXXX-XXXX-XXXX-XXXX"
          aria-label="License key"
          spellCheck={false}
          className={`${inputClass} font-mono`}
        />
        <Button onClick={activate} disabled={!key.trim()}>
          Activate license
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-[12px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
