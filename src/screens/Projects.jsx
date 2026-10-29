// Every project this browser opened: open one, or take it off the list. Opened from the header.
import { useEffect, useState } from 'react';
import { ChevronRight, FolderOpen, Loader2, Plus, Trash2 } from 'lucide-react';
import { useT } from '../i18n.js';
import { getProject } from '../api.js';
import { forget, mine } from '../mine.js';
import EasyToggle from '../components/EasyToggle.jsx';
import { areas, jobsFrom, priceSmeta } from '../../lib/estimate.mjs';
import { progress } from '../../lib/board.mjs';

const STEP_LABEL = { analyze: 'step_film', measure: 'step_measure', smeta: 'step_smeta', check: 'step_smeta', jobs: 'step_jobs', hire: 'step_jobs' };
const pad = i => String(i + 1).padStart(4, '0');

export default function Projects({ config, open, onCount }) {
  const t = useT();
  const [list, setList] = useState(null);

  useEffect(() => {
    Promise.all(mine().map(m => getProject(m.id).then(p => ({ ...m, p })).catch(() => { forget(m.id); return null; })))
      .then(l => setList(l.filter(Boolean)));
  }, []);

  const remove = id => {
    if (!confirm(t('pr_remove_q'))) return;
    forget(id);
    setList(l => l.filter(x => x.id !== id));
    onCount?.();
  };

  return (
    <main className="page">
      <div className="pr-head">
        <div>
          <h1 className="pr-title"><FolderOpen size={26} />{t('mine_title')}</h1>
          <p className="muted">{t('pr_sub')}</p>
          <EasyToggle />
        </div>
        <a className="btn" href="#/"><Plus size={18} />{t('pr_new')}</a>
      </div>

      {!list && <p className="muted"><Loader2 size={16} className="spin" /> {t('loading')}</p>}
      {list?.length === 0 && (
        <div className="card pr-empty">
          <FolderOpen size={32} />
          <p>{t('pr_empty')}</p>
          <a className="btn" href="#/"><Plus size={18} />{t('pr_new')}</a>
        </div>
      )}

      <div className="pr-list">
        {list?.map(({ id, step, at, p }) => {
          const smeta = p.plan && priceSmeta(p.plan.works, config.prices, p.tier);
          const plan = smeta && progress(p.board, jobsFrom(smeta, config.prices));
          return (
            <div key={id} className="card pr-card">
              <button className="pr-open" onClick={() => open(p, step || 'analyze')}>
                <img src={`/media/${id}/${p.render?.after ?? `frames/${pad(p.hero_frame ?? 0)}.jpg`}`} alt="" />
                <span className="pr-body">
                  <b>{t(`room_${p.measure?.room_type ?? 'other'}`)}{p.measure && <span className="nowrap"> · {t.num(areas(p.measure).floor)} m²</span>}</b>
                  {smeta && <span className="pr-sum tab">{t.money(smeta.total)}</span>}
                  <span className="muted small">
                    {t(STEP_LABEL[step] ?? 'step_film')}{plan ? ` · ${t('pl_found', { n: plan.hired, t: plan.total })}` : ''}
                  </span>
                  <span className="muted tiny">{t('pr_opened', { d: new Date(at).toLocaleDateString(t.lang) })}</span>
                </span>
                <ChevronRight size={20} className="pr-go" />
              </button>
              <button className="pr-del" onClick={() => remove(id)} aria-label={t('pr_remove')} title={t('pr_remove')}><Trash2 size={16} /></button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
