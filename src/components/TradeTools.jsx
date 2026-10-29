// Inside a trade's card in the plan: the agreement with the usta, the check before paying,
// and the payment notebook. Everything is saved on the board card (project.board[trade]).
import { useRef, useState } from 'react';
import { AlertTriangle, Camera, Check, ClipboardCheck, Copy, FileSignature, Loader2, Plus, Send, Trash2, Wallet, X } from 'lucide-react';
import { makeT, useT } from '../i18n.js';
import { checksDone, checksFor, paidOf, STAGES } from '../../lib/checks.mjs';
import { parseSum } from '../../lib/board.mjs';
import { shareText } from '../share.js';

const TABS = ['scope', 'deal', 'check', 'pay'];

export default function TradeTools({ project, job, card, prices, save, scope, tab, setTab }) {
  const t = useT();
  const ch = checksDone(card, job.trade);
  const paid = paidOf(card);
  const badge = {
    deal: card.agreement?.ok_at ? '✓' : '',
    check: ch.total ? `${ch.ok}/${ch.total}` : '',
    pay: paid && card.price ? `${Math.round((paid / card.price) * 100)}%` : '',
  };
  return (
    <>
      <div className="tt-tabs" role="tablist">
        {TABS.map(k => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {t(`tt_${k}`)}{badge[k] && <b className={k === 'check' && ch.bad ? 'bad' : ''}>{badge[k]}</b>}
          </button>
        ))}
      </div>
      {tab === 'scope' && scope}
      {tab === 'deal' && <Deal project={project} job={job} card={card} prices={prices} save={save} />}
      {tab === 'check' && <Checks job={job} card={card} prices={prices} save={save} />}
      {tab === 'pay' && <Payments project={project} job={job} card={card} save={save} setTab={setTab} />}
    </>
  );
}

// ---------- agreement ----------
function agreementText(l, { project, job, card, prices, deal }) {
  const t = makeT(l);
  const st = STAGES[deal.stages];
  const price = card.price || job.fair[1];
  const parts = [
    [st[0], t('ag_pay_start')], [st[1], t('ag_pay_mid')], [st[2], t('ag_pay_end')],
  ].filter(([k]) => k > 0).map(([k, when]) => `- ${Math.round(k * 100)}%: ${t.money(Math.round(price * k))}, ${when}`);
  const checks = checksFor(job.trade).map(x => `- ${t.pick(x)}`);
  return [
    t('ag_head', { trade: t.pick(prices.trades[job.trade]).toUpperCase() }),
    `${t('ag_place')}: ${t('ag_city')}${project.district ? `, ${project.district}` : ''}`,
    `${t('ag_owner')}: ____________________`,
    `${t('ag_usta')}: ${card.usta?.name || '____________________'}${card.usta?.phone ? `, +${card.usta.phone}` : ''}`,
    '',
    `${t('ag_works')}:`,
    ...job.lines.map((x, i) => `${i + 1}. ${t.pick(x.name)}: ${t.num(x.qty)} ${t.unit(x.unit)}`),
    '',
    `${t('ag_price')}: ${t.money(price)} (${t(deal.materials === 'usta' ? 'ag_with_mat' : 'ag_labor_only')})`,
    `${t('ag_start')}: ${card.start || '____'}. ${t('ag_days', { n: t.day(job.days) })}`,
    '',
    `${t('ag_pay')}:`,
    ...parts,
    '',
    `${t('ag_accept')}:`,
    ...checks,
    '',
    t('ag_fix', { m: deal.guarantee }),
    t('ag_extra'),
    '',
    `${t('ag_date')}: ${new Date().toLocaleDateString(l)}`,
    `${t('ag_owner')}: ________    ${t('ag_usta')}: ________`,
  ].join('\n');
}

function Deal({ project, job, card, prices, save }) {
  const t = useT();
  const deal = { stages: '30-40-30', materials: 'owner', guarantee: 6, lang: t.lang === 'ru' ? 'ru' : 'uz', ...card.agreement };
  const [copied, setCopied] = useState(false);
  if (!card.price) return <p className="tt-empty">{t('ag_need_price')}</p>;
  const set = patch => save(c => ({ ...c, agreement: { ...deal, ...patch } }));
  const text = agreementText(deal.lang, { project, job, card, prices, deal });
  const send = async () => { await shareText(text); if (!card.agreement?.sent_at) set({ sent_at: new Date().toISOString() }); };
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* no clipboard */ } };
  return (
    <div className="tt-body">
      <p className="muted small" style={{ margin: 0 }}>{t('ag_sub')}</p>
      <div className="tt-opts">
        <label>{t('ag_pay')}
          <select className="input" value={deal.stages} onChange={e => set({ stages: e.target.value })}>
            {Object.keys(STAGES).map(k => <option key={k} value={k}>{k.replaceAll('-', ' / ')} %</option>)}
          </select>
        </label>
        <label>{t('ag_mat')}
          <select className="input" value={deal.materials} onChange={e => set({ materials: e.target.value })}>
            <option value="owner">{t('ag_mat_owner')}</option><option value="usta">{t('ag_mat_usta')}</option>
          </select>
        </label>
        <label>{t('ag_guar')}
          <select className="input" value={deal.guarantee} onChange={e => set({ guarantee: +e.target.value })}>
            {[3, 6, 12].map(m => <option key={m} value={m}>{t('ag_months', { n: m })}</option>)}
          </select>
        </label>
        <label>{t('ag_lang')}
          <select className="input" value={deal.lang} onChange={e => set({ lang: e.target.value })}>
            <option value="uz">O'zbekcha</option><option value="ru">Русский</option>
          </select>
        </label>
      </div>
      <pre className="ag-text">{text}</pre>
      <div className="row wrap" style={{ gap: 8 }}>
        <button className="btn tg" onClick={send}><Send size={16} />{t('ag_send')}</button>
        <button className="btn ghost" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? t('ag_copied') : t('ag_copy')}</button>
        {card.agreement?.ok_at
          ? <span className="pill v-fair" style={{ marginLeft: 'auto' }}><Check size={12} strokeWidth={3} />{t('ag_ok_on', { d: new Date(card.agreement.ok_at).toLocaleDateString(t.lang) })}</span>
          : <button className="btn dark" style={{ marginLeft: 'auto' }} onClick={() => set({ ok_at: new Date().toISOString() })}><FileSignature size={16} />{t('ag_ok')}</button>}
      </div>
    </div>
  );
}

// ---------- check before paying ----------
function Checks({ job, card, prices, save }) {
  const t = useT();
  const list = checksFor(job.trade);
  const ch = checksDone(card, job.trade);
  const mark = (i, v) => save(c => ({ ...c, checks: { ...c.checks, [i]: c.checks?.[i] === v ? undefined : v } }));
  const problems = list.filter((_, i) => card.checks?.[i] === 'bad');
  const tell = () => shareText(`${t('ck2_tell_head', { trade: t.pick(prices.trades[job.trade]) })}\n${problems.map(x => `- ${t.pick(x)}`).join('\n')}\n\n${t('ck2_tell_tail')}`);
  return (
    <div className="tt-body">
      <p className="muted small" style={{ margin: 0 }}>{t('ck2_sub')}</p>
      <ul className="checks">
        {list.map((x, i) => {
          const v = card.checks?.[i];
          return (
            <li key={i} className={v ? `is-${v}` : ''}>
              <span className="grow">{t.pick(x)}</span>
              <button className={`ck ok${v === 'ok' ? ' on' : ''}`} onClick={() => mark(i, 'ok')} aria-label={t('ck2_ok')} title={t('ck2_ok')}><Check size={16} strokeWidth={3} /></button>
              <button className={`ck bad${v === 'bad' ? ' on' : ''}`} onClick={() => mark(i, 'bad')} aria-label={t('ck2_bad')} title={t('ck2_bad')}><X size={16} strokeWidth={3} /></button>
            </li>
          );
        })}
      </ul>
      {ch.all && <div className="tt-note ok"><ClipboardCheck size={16} />{t('ck2_all')}</div>}
      {problems.length > 0 && (
        <div className="tt-note bad">
          <AlertTriangle size={16} /><span className="grow">{t('ck2_bad_n', { n: problems.length })}</span>
          <button className="btn sm tg" onClick={tell}><Send size={14} />{t('ck2_tell')}</button>
        </div>
      )}
    </div>
  );
}

// ---------- payment notebook ----------
function Payments({ project, job, card, save, setTab }) {
  const t = useT();
  const price = card.price || 0;
  const paid = paidOf(card);
  const st = STAGES[card.agreement?.stages ?? '30-40-30'];
  const n = card.payments?.length ?? 0;
  // The next stage that isn't covered yet suggests the amount.
  const due = st.map((k, i) => st.slice(0, i + 1).reduce((s, x) => s + x, 0) * price);
  const nextIdx = due.findIndex(d => d > paid + 1);
  const what = nextIdx < 0 ? 'final' : ['avans', 'stage', 'final'][nextIdx];
  const [adding, setAdding] = useState(false);
  const [sum, setSum] = useState('');
  const [kind, setKind] = useState(what);
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const file = useRef();
  const ch = checksDone(card, job.trade);
  const value = parseSum(sum);

  const open = () => {
    setKind(what);
    setSum(nextIdx < 0 ? '' : String(Math.round(due[nextIdx] - paid)));
    setPhoto(null); setAdding(true);
  };
  // The last payment is whatever is left; the others follow the agreed stages.
  const pickKind = k => {
    setKind(k);
    const i = ['avans', 'stage', 'final'].indexOf(k);
    const left = price - paid;
    if (left > 0) setSum(String(Math.round(k === 'final' ? left : Math.min(left, st[i] * price))));
  };
  const pick = async e => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const ext = (f.name.match(/\.\w+$/)?.[0] || '.jpg').toLowerCase();
      const r = await fetch(`/api/project/${project.id}/photo?kind=receipt&name=p${ext}`, { method: 'POST', body: f });
      const b = await r.json();
      if (r.ok) setPhoto(b.file);
    } finally { setBusy(false); }
  };
  const add = async e => {
    e.preventDefault();
    if (!value) return;
    setBusy(true);
    await save(c => ({ ...c, payments: [...(c.payments ?? []), { sum: value, kind, at: new Date().toISOString(), photo }] }));
    setBusy(false); setAdding(false);
  };
  const remove = i => { if (confirm(t('pay_del_q'))) save(c => ({ ...c, payments: c.payments.filter((_, k) => k !== i) })); };

  if (!price) return <p className="tt-empty">{t('ag_need_price')}</p>;
  return (
    <div className="tt-body">
      <div className="pay-sum">
        <div><span className="tiny muted">{t('pay_paid')}</span><b className="tab">{t.money(paid)}</b></div>
        <div><span className="tiny muted">{t('pay_left')}</span><b className="tab">{t.money(Math.max(0, price - paid))}</b></div>
        <div className="pay-bar"><i style={{ width: `${Math.min(100, (paid / price) * 100)}%` }} /></div>
      </div>
      {paid > price && <div className="tt-note bad"><AlertTriangle size={16} />{t('pay_over', { x: t.money(paid - price) })}</div>}
      {n > 0 && (
        <ul className="pays">
          {card.payments.map((p, i) => (
            <li key={i}>
              {p.photo ? <a href={`/media/${project.id}/${p.photo}`} target="_blank" rel="noreferrer"><img src={`/media/${project.id}/${p.photo}`} alt="" /></a> : <span className="pay-ic"><Wallet size={16} /></span>}
              <span className="grow"><b className="tab">{t.money(p.sum)}</b><span className="muted tiny">{t(`pay_${p.kind}`)} · {new Date(p.at).toLocaleDateString(t.lang)}</span></span>
              <button className="pr-del" style={{ position: 'static' }} onClick={() => remove(i)} aria-label={t('pr_remove')}><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <form className="agree" onSubmit={add}>
          <div className="seg">{['avans', 'stage', 'final'].map(k => <button type="button" key={k} className={kind === k ? 'on' : ''} onClick={() => pickKind(k)}>{t(`pay_${k}`)}</button>)}</div>
          {kind === 'final' && !ch.all && (
            <div className="tt-note bad"><AlertTriangle size={16} /><span className="grow">{t('pay_check_first')}</span>
              <button type="button" className="btn sm ghost" onClick={() => setTab('check')}>{t('tt_check')}</button></div>
          )}
          <div className="row" style={{ gap: 8 }}>
            <input className="input grow" inputMode="decimal" value={sum} onChange={e => setSum(e.target.value)} placeholder={t('cs_price_ph')} autoFocus />
            {value > 0 && <span className="tab small nowrap">{t.money(value)}</span>}
          </div>
          <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
          <button type="button" className={`btn ghost receipt${photo ? ' has' : ''}`} onClick={() => file.current.click()} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : photo ? <Check size={16} /> : <Camera size={16} />}{photo ? t('pay_photo_ok') : t('pay_photo')}
          </button>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost" onClick={() => setAdding(false)}>{t('cs_later')}</button>
            <button className="btn dark" disabled={!value || busy}><Check size={16} />{t('cs_save')}</button>
          </div>
        </form>
      ) : (
        <button className="btn dark" onClick={open}><Plus size={16} />{t('pay_add')}</button>
      )}
    </div>
  );
}
