import { useMemo } from 'react';
import { ArrowRight, CalendarDays, Package } from 'lucide-react';
import { useT } from '../i18n.js';
import { TRADE } from '../colors.js';
import { jobsFrom, priceSmeta } from '../../lib/estimate.mjs';

export default function Jobs({ project, config, go }) {
  const t = useT();
  const { prices } = config;
  const jobs = useMemo(() => jobsFrom(priceSmeta(project.plan.works, prices, project.tier), prices), [project, prices]);

  return (
    <main className="page">
      <div className="section-title">
        <div>
          <h2>{t('jb_title')}</h2>
          <p className="muted" style={{ margin: '8px 0 0' }}>{t('jb_sub')}</p>
        </div>
        <span className="badge">{jobs.length}</span>
      </div>
      <div className="jobs">
        {jobs.map((j, i) => {
          const { color, Icon } = TRADE[j.trade];
          return (
            <article key={j.trade} className="card job rise" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="strip" style={{ background: color }} />
              <div className="body">
                <div className="row">
                  <span className="icon" style={{ background: color }}><Icon size={22} /></span>
                  <div className="grow">
                    <h3>{t.pick(prices.trades[j.trade])}</h3>
                    <span className="muted small row" style={{ gap: 6 }}><CalendarDays size={13} />{t.span(j.start, j.end)}</span>
                  </div>
                </div>
                <ul className="scope">
                  {j.lines.map(l => (
                    <li key={l.item_id}><span>{t.pick(l.name)}</span><span className="tab">{t.num(l.qty)} {t.unit(l.unit)}</span></li>
                  ))}
                </ul>
                <div className="fair">
                  <div className="label">{t('jb_fair')}</div>
                  <div className="v tab">{t.range(j.fair)}</div>
                  <div className="muted tiny row" style={{ gap: 6, marginTop: 4 }}><Package size={12} />{t('jb_materials')}: {t.mln(j.materials)}</div>
                </div>
                <button className="btn dark" onClick={() => go('hire', j.trade)}>{t('jb_find')}<ArrowRight size={17} /></button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
