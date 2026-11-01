// The database page: every usta and every store Remont found, to search and browse.
// Ustas come from data/ustas_directory.json, stores from data/stores_directory.json; both were read by Muse Spark.
import { useEffect, useRef, useState } from 'react';
import { Blocks, Bath, Brush, Database, DoorOpen, ExternalLink, Flame, Lamp, Layers, Loader2, MapPin, Phone, Search, Send, Sofa, Store, Users, Wrench, Zap } from 'lucide-react';
import { DISTRICTS, useT } from '../i18n.js';
import { browse } from '../api.js';
import { UstaCard, ago, tint } from './Hire.jsx';
import EasyToggle from '../components/EasyToggle.jsx';

export const CATS = { materials: Blocks, tiles_floor: Layers, plumbing: Bath, electrical: Zap, paint_walls: Brush, doors_windows: DoorOpen, ceiling: Lamp, heating: Flame, tools: Wrench, furniture: Sofa };

function StoreCard({ s, i, t }) {
  const Icon = CATS[s.cats[0]] ?? Store;
  const about = t.pick(s.about);
  const where = [s.market, ...s.districts.map(d => t.district(d))].filter(Boolean).join(', ') || (s.city === 'tashkent_region' ? t('hi_region') : t('hi_city'));
  return (
    <div className="usta real" style={{ animationDelay: `${(i % 24) * 0.03}s` }}>
      <span className="avatar" style={{ background: tint(s.id)[0], color: tint(s.id)[1] }}><Icon size={18} /></span>
      <div style={{ minWidth: 0 }}>
        <div className="name">{s.name || about}</div>
        {s.name && <div className="why" style={{ marginTop: 2 }}>{about}</div>}
        <div className="meta" style={{ marginTop: 6 }}>
          <span className="row" style={{ gap: 3 }}><MapPin size={12} />{where}</span>
          {s.cats.map(c => <span key={c} className="pill db-cat">{t(`cat_${c}`)}</span>)}
          {s.members > 0 && <span>{t('db_members', { n: s.members.toLocaleString('ru-RU') })}</span>}
          {s.last_seen && <span>{t('hi_last_ad', { d: ago(t, s.last_seen) })}</span>}
        </div>
      </div>
      <div className="contact">
        {s.phone && <a className="btn sm call" href={`tel:+${s.phone}`}><Phone size={14} />{t('hi_call')}</a>}
        {s.tg && <a className="btn sm tg" href={`https://t.me/${s.tg.slice(1)}`} target="_blank" rel="noreferrer"><Send size={14} />{s.source === 'channel' ? t('db_channel') : 'Telegram'}</a>}
        {s.link && s.source !== 'channel' && <a className="tiny muted ad-link" href={s.link} target="_blank" rel="noreferrer"><ExternalLink size={11} />{t('hi_see_ad')}</a>}
      </div>
    </div>
  );
}

export default function Browse({ config }) {
  const t = useT();
  const [type, setType] = useState(() => (location.hash.includes('stores') ? 'stores' : 'ustas'));
  const [cat, setCat] = useState('');
  const [district, setDistrict] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const typing = useRef();

  // Search as you type, a moment after the last key.
  const load = (offset = 0) => {
    setBusy(true);
    browse({ type, cat, district, q, offset })
      .then(r => setData(d => (offset ? { ...r, items: [...d.items, ...r.items] } : r)))
      .catch(() => {}).finally(() => setBusy(false));
  };
  useEffect(() => {
    clearTimeout(typing.current);
    typing.current = setTimeout(() => load(0), q ? 300 : 0);
    return () => clearTimeout(typing.current);
  }, [type, cat, district, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = next => { setType(next); setCat(''); setData(null); history.replaceState(null, '', `#/browse${next === 'stores' ? '/stores' : ''}`); };

  const src = config.directory?.sources ?? {};
  const storeSrc = config.stores?.sources ?? {};
  const keys = type === 'stores' ? Object.keys(CATS) : Object.keys(config.prices.trades);
  const label = k => (type === 'stores' ? t(`cat_${k}`) : t.pick(config.prices.trades[k]));

  return (
    <main className="page">
      <section className="db-hero rise">
        <div className="db-hero-text">
          <h1 className="pr-title"><Database size={26} />{t('db_title')}</h1>
          <p className="muted">{t('db_sub')}</p>
        </div>
        <div className="db-stats">
          <div><b className="tab">{(config.directory?.total ?? 0).toLocaleString('ru-RU')}</b><span>{t('db_n_ustas')}</span></div>
          <div><b className="tab">{(config.stores?.total ?? 0).toLocaleString('ru-RU')}</b><span>{t('db_n_stores')}</span></div>
          <div><b className="tab">{(src.telegram_ads ?? 0).toLocaleString('ru-RU')}</b><span>{t('db_n_ads')}</span></div>
          <div><b className="tab">{((src.telegram_chats ?? 0) + (storeSrc.channels ?? 0) + (storeSrc.groups ?? 0)).toLocaleString('ru-RU')}</b><span>{t('db_n_groups')}</span></div>
        </div>
      </section>

      <div className="db-bar">
        <div className="seg db-tabs">
          <button className={type === 'ustas' ? 'on' : ''} onClick={() => pick('ustas')}><Users size={15} />{t('db_ustas')}</button>
          <button className={type === 'stores' ? 'on' : ''} onClick={() => pick('stores')}><Store size={15} />{t('db_stores')}</button>
        </div>
        <label className="db-search">
          <Search size={17} />
          <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder={t('db_search_ph')} />
        </label>
        <select className="input db-district" value={district} onChange={e => setDistrict(e.target.value)} aria-label={t('hi_where')}>
          <option value="">{t('db_any_district')}</option>
          {DISTRICTS.map(d => <option key={d} value={d}>{t.district(d)}</option>)}
        </select>
      </div>

      <div className="db-chips">
        <button className={!cat ? 'on' : ''} onClick={() => setCat('')}>{t('db_all')}</button>
        {keys.filter(k => data?.counts?.[k] || k === cat).map(k => {
          const Icon = type === 'stores' ? CATS[k] : null;
          return (
            <button key={k} className={cat === k ? 'on' : ''} onClick={() => setCat(cat === k ? '' : k)}>
              {Icon && <Icon size={14} />}{label(k)}<span className="tab">{data?.counts?.[k] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {data && <p className="muted small" style={{ margin: '4px 2px 12px' }}>{t('db_found', { n: data.total.toLocaleString('ru-RU') })}{busy && <Loader2 size={13} className="spin" style={{ display: 'inline', marginLeft: 8, verticalAlign: -2 }} />}</p>}
      {!data && <p className="muted"><Loader2 size={16} className="spin" style={{ display: 'inline', verticalAlign: -3 }} /> {t('loading')}</p>}
      {data?.total === 0 && <div className="card pr-empty"><Search size={28} /><p>{t('db_none')}</p></div>}

      <div className="card db-list">
        {data?.items.map((x, i) => (type === 'stores'
          ? <StoreCard key={x.id} s={x} i={i} t={t} />
          : <UstaCard key={x.id} u={x} i={i % 24} t={t} trades={config.prices.trades} />))}
      </div>
      {data && data.items.length < data.total && (
        <button className="btn ghost show-all" onClick={() => load(data.items.length)} disabled={busy}>
          {busy && <Loader2 size={16} className="spin" />}{t('db_more')} ({(data.total - data.items.length).toLocaleString('ru-RU')})
        </button>
      )}
      <p className="muted tiny" style={{ marginTop: 14 }}>{t('db_note')}</p>
      <EasyToggle />
    </main>
  );
}
