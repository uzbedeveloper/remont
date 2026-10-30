// "I have 15 mln, what can I do?" The owner types a budget; code picks the best tier that fits and,
// if needed, moves trades that can wait (ceiling, windows and doors, floor, tiles) to later.
// The answer is concrete: what waits and what it costs, what's left over, what more money would buy.
import { useMemo, useState } from 'react';
import { ArrowUpRight, Check, Clock, Loader2, Undo2, Wallet } from 'lucide-react';
import { useT } from '../i18n.js';
import { patch } from '../api.js';
import { fitBudget, priceSmeta, TIERS } from '../../lib/estimate.mjs';
import { parseSum } from '../../lib/board.mjs';

export default function Budget({ project, setProject, prices }) {
  const t = useT();
  const [text, setText] = useState(project.budget ? String(project.budget) : '');
  const [busy, setBusy] = useState(false);
  const sum = parseSum(text);
  const later = project.plan.postponed ?? [];
  // Always fit the whole wish list, including what was postponed before.
  const all = useMemo(() => [...project.plan.works, ...later], [project.plan]); // eslint-disable-line react-hooks/exhaustive-deps
  const fit = useMemo(() => (sum ? fitBudget(all, prices, sum) : null), [all, prices, sum]);
  const byId = useMemo(() => Object.fromEntries(prices.items.map(i => [i.id, i])), [prices]);
  const laterTrades = [...new Set(later.map(w => byId[w.item_id]?.trade).filter(Boolean))];
  const same = fit && fit.tier === (project.tier || 'standard') && [...fit.later].sort().join() === [...laterTrades].sort().join();

  // The works that wait, priced per trade at the tier that fits, and the next step up.
  const info = useMemo(() => {
    if (!fit?.fits) return null;
    const waiting = all.filter(w => fit.later.includes(byId[w.item_id]?.trade));
    const groups = fit.later.map(tr => {
      const lines = priceSmeta(waiting.filter(w => byId[w.item_id]?.trade === tr), prices, fit.tier).lines;
      return { trade: tr, names: lines.map(l => l.name), total: lines.reduce((s, l) => s + l.total, 0) };
    });
    let more = null;
    if (fit.later.length) more = { key: 'bu_more_all', tier: fit.tier, need: priceSmeta(all, prices, fit.tier).total - sum };
    else if (fit.tier !== TIERS.at(-1)) {
      const up = TIERS[TIERS.indexOf(fit.tier) + 1];
      more = { key: 'bu_more_tier', tier: up, need: priceSmeta(all, prices, up).total - sum };
    }
    return { groups, left: sum - fit.total, more };
  }, [fit, all, byId, prices, sum]);

  const apply = async () => {
    setBusy(true);
    const postponed = all.filter(w => fit.later.includes(byId[w.item_id]?.trade));
    const tier_before = project.plan.tier_before ?? project.tier ?? 'standard';
    setProject(await patch(project.id, { tier: fit.tier, plan: { ...project.plan, works: fit.keep, postponed, tier_before } }));
    setBusy(false);
  };
  const restore = async () => {
    setBusy(true);
    const { tier_before, ...plan } = project.plan;
    setProject(await patch(project.id, { tier: tier_before ?? project.tier, plan: { ...plan, works: all, postponed: [] } }));
    setBusy(false);
  };
  const laterNames = [...new Set(later.map(w => byId[w.item_id] && t.pick(byId[w.item_id].name)).filter(Boolean))];

  return (
    <section className="card pad budget no-print">
      <h3 className="row" style={{ fontSize: 20, gap: 8 }}><Wallet size={20} />{t('bu_title')}</h3>
      <p className="muted small" style={{ margin: '6px 0 12px' }}>{t('bu_sub')}</p>
      <div className="row" style={{ gap: 8 }}>
        <input className="input grow" inputMode="decimal" value={text} onChange={e => setText(e.target.value)} placeholder={t('bu_ph')} />
        {sum > 0 && <span className="tab small nowrap">{t.money(sum)}</span>}
      </div>
      {fit && (
        <div className={`bu-result${fit.fits ? ' ok' : ' short'}`}>
          <b>{fit.fits ? t('bu_fits', { tier: t(`tier_${fit.tier}`), total: t.money(fit.total) }) : t('bu_short', { short: t.money(fit.short) })}</b>
          {info && info.left > 0 && <p className="small">{t('bu_left', { left: t.money(info.left) })}</p>}
          {info && info.groups.length > 0 && (
            <div className="bu-wait">
              <div className="small">{t('bu_wait_h')}</div>
              {info.groups.map(g => (
                <div key={g.trade} className="bu-wait-row">
                  <span className="grow">
                    <b>{t.pick(prices.trades[g.trade])}</b>
                    <span className="tiny">{g.names.map(n => t.pick(n)).join(', ')}</span>
                  </span>
                  <span className="tab small nowrap">{t.money(g.total)}</span>
                </div>
              ))}
            </div>
          )}
          {info?.more && info.more.need > 0 && (
            <p className="small row" style={{ gap: 6 }}><ArrowUpRight size={15} />{t(info.more.key, { tier: t(`tier_${info.more.tier}`), sum: t.money(info.more.need) })}</p>
          )}
          {!fit.fits && <p>{t('bu_short_d', { total: t.money(fit.total) })}</p>}
          {fit.fits && !same && (
            <button className="btn dark" onClick={apply} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Check size={16} />}{t('bu_apply')}</button>
          )}
          {fit.fits && same && <p className="row" style={{ gap: 6 }}><Check size={15} />{t('bu_applied')}</p>}
        </div>
      )}
      {later.length > 0 && (
        <div className="bu-later">
          <Clock size={16} />
          <span className="grow">{t('bu_later_now', { list: laterNames.join(', ') })}</span>
          <button className="btn sm ghost" onClick={restore} disabled={busy}><Undo2 size={14} />{t('bu_restore')}</button>
        </div>
      )}
    </section>
  );
}
