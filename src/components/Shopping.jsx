// The bozor list: every material the smeta needs, grouped by the trade that needs it, in work order.
// Tick what's bought (saved with the project); share the rest to Telegram so a relative can buy it.
import { useMemo, useState } from 'react';
import { Check, ChevronDown, Send, ShoppingCart } from 'lucide-react';
import { useT } from '../i18n.js';
import { patch } from '../api.js';
import { TRADE } from '../colors.js';
import { shoppingList } from '../../lib/estimate.mjs';
import { shareText } from '../share.js';

export default function Shopping({ project, setProject, smeta, prices }) {
  const t = useT();
  const groups = useMemo(() => shoppingList(smeta, prices), [smeta, prices]);
  const [open, setOpen] = useState(false);
  const bought = project.bought ?? {};
  const id = (g, it) => `${g.trade}|${it.key}`;
  const all = groups.flatMap(g => g.items.map(it => ({ g, it })));
  const left = all.filter(({ g, it }) => !bought[id(g, it)]);
  const leftSum = left.reduce((s, x) => s + x.it.total, 0);

  const toggle = async key => {
    const next = { ...bought, [key]: !bought[key] };
    if (!next[key]) delete next[key];
    setProject({ ...project, bought: next });
    setProject(await patch(project.id, { bought: next }));
  };

  const share = () => {
    const lines = groups.map(g => {
      const items = g.items.filter(it => !bought[id(g, it)]);
      if (!items.length) return '';
      return `${t.pick(prices.trades[g.trade])} (${t('sh_by_day', { d: t.day(g.start + 1) })}):\n${items.map(it => `☐ ${t.pick(it.name)}: ${t.num(it.qty)} ${t.unit(it.unit)}`).join('\n')}`;
    }).filter(Boolean).join('\n\n');
    shareText(`${t('sh_share_title', { sum: t.money(leftSum) })}\n\n${lines}`);
  };

  return (
    <section className="card pad shop">
      <div className="section-title">
        <div>
          <h3 style={{ fontSize: 20 }} className="row"><ShoppingCart size={20} />{t('sh_title')}</h3>
          <p className="muted small" style={{ margin: '6px 0 0' }}>{t('sh_sub')}</p>
        </div>
        <button className="btn sm tg no-print" onClick={share} disabled={!left.length}><Send size={15} />{t('sh_send')}</button>
      </div>
      <div className="shop-sum">
        <span>{t('sh_left', { n: left.length, all: all.length })}</span>
        <b className="tab">{t.money(leftSum)}</b>
      </div>
      <div className={`shop-groups${open ? ' open' : ''}`}>
        {groups.map(g => (
          <div key={g.trade} className="shop-group">
            <div className="shop-head">
              <span className="dot" style={{ background: TRADE[g.trade].color }} />
              <b>{t.pick(prices.trades[g.trade])}</b>
              <span className="muted tiny">{t('sh_by_day', { d: t.day(g.start + 1) })}</span>
              <span className="grow" />
              <span className="tab small">{t.money(g.total)}</span>
            </div>
            <ul>
              {g.items.map(it => {
                const k = id(g, it), on = Boolean(bought[k]);
                return (
                  <li key={k}>
                    <button className={`shop-item${on ? ' on' : ''}`} onClick={() => toggle(k)} aria-pressed={on}>
                      <span className="box">{on && <Check size={14} strokeWidth={3} />}</span>
                      <span className="grow">{t.pick(it.name)}</span>
                      <span className="tab qty">{t.num(it.qty)} {t.unit(it.unit)}</span>
                      <span className="tab muted small">{t.money(it.total)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {!open && <button className="btn ghost show-all no-print" onClick={() => setOpen(true)}>{t('sh_show')}<ChevronDown size={16} /></button>}
    </section>
  );
}
