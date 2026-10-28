import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { I18n, LANGS, makeT } from './i18n.js';
import { getConfig, getProject } from './api.js';
import Home from './screens/Home.jsx';
import Analyze from './screens/Analyze.jsx';
import Measure from './screens/Measure.jsx';
import Smeta from './screens/Smeta.jsx';
import Jobs from './screens/Jobs.jsx';
import Hire from './screens/Hire.jsx';
import Talk from './components/Talk.jsx';
import CheckQuote from './screens/Check.jsx';

const STEPS = ['analyze', 'measure', 'smeta', 'jobs', 'hire'];
const STEP_LABEL = { analyze: 'step_film', measure: 'step_measure', smeta: 'step_smeta', jobs: 'step_jobs', hire: 'step_hire' };

function readRoute() {
  const [, id, step = 'analyze', trade] = location.hash.replace(/^#\/?/, '').split('/');
  return location.hash.startsWith('#/p/') ? { id, step, trade } : { id: null };
}

function storedLang() {
  try { return localStorage.getItem('lang') || 'uz'; } catch { return 'uz'; }
}

export default function App() {
  const [lang, setLang] = useState(storedLang);
  const t = useMemo(() => makeT(lang), [lang]);
  const [route, setRoute] = useState(readRoute);
  const [config, setConfig] = useState(null);
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const on = () => { setRoute(readRoute()); window.scrollTo({ top: 0 }); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { getConfig().then(setConfig).catch(e => setError(e.message)); }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem('lang', lang); } catch { /* private mode */ }
  }, [lang]);
  useEffect(() => {
    if (!route.id) { setProject(null); return; }
    if (project?.id === route.id) return;
    setProject(null);
    getProject(route.id).then(setProject).catch(e => setError(e.message));
  }, [route.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // While the server finishes SAM, the first smeta and the first picture, poll the project.
  const bgBusy = Boolean(project?.bg && ['sam', 'plan', 'render'].some(k => project.bg[k]) && Date.now() - Date.parse(project.bg.at) < 180000);
  useEffect(() => {
    if (!bgBusy) return;
    const id = project.id;
    const timer = setInterval(() => {
      getProject(id).then(p => setProject(cur => (cur?.id === p.id && cur.updated !== p.updated ? p : cur))).catch(() => {});
    }, 2500);
    return () => clearInterval(timer);
  }, [bgBusy, project?.id]);

  const go = useCallback((step, trade) => {
    location.hash = step === 'home' ? '#/' : `#/p/${route.id ?? project?.id}/${step}${trade ? `/${trade}` : ''}`;
  }, [route.id, project?.id]);
  const open = useCallback((p, step) => { setProject(p); location.hash = `#/p/${p.id}/${step}`; }, []);

  const reach = p => ({
    analyze: true, measure: Boolean(p?.measure), smeta: Boolean(p?.measure), jobs: Boolean(p?.plan), hire: Boolean(p?.plan),
  });
  const can = reach(project);
  const stepIdx = STEPS.indexOf(route.step);

  let screen;
  if (error) screen = <div className="page"><div className="err">{t('error', { e: error })}</div></div>;
  else if (!config) screen = <div className="page muted">{t('loading')}</div>;
  else if (!route.id) screen = <Home config={config} open={open} />;
  else if (!project) screen = <div className="page muted">{t('loading')}</div>;
  else {
    const props = { project, setProject, config, go, trade: route.trade };
    screen = {
      analyze: <Analyze {...props} />, measure: <Measure {...props} />, smeta: <Smeta {...props} />,
      jobs: <Jobs {...props} />, hire: <Hire {...props} />, check: <CheckQuote {...props} />,
    }[route.step] ?? <Analyze {...props} />;
  }

  return (
    <I18n.Provider value={t}>
      <header className="top">
        <div className="top-in">
          <a className="logo" href="#/"><span className="logo-mark">R</span>Remont</a>
          {project && route.id ? (
            <nav className="steps">
              {STEPS.map((s, i) => (
                <button key={s} disabled={!can[s]} onClick={() => go(s)}
                  className={`step${s === route.step ? ' on' : i < stepIdx || (can[STEPS[i + 1]] && s !== route.step) ? ' done' : ''}`}>
                  <span className="dot">{i < stepIdx ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                  <span className="lbl">{t(STEP_LABEL[s])}</span>
                </button>
              ))}
            </nav>
          ) : <div className="grow" />}
          <div className="langs">
            {LANGS.map(l => <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
          </div>
        </div>
      </header>
      {screen}
      {config && project?.measure && route.id === project.id && <Talk project={project} setProject={setProject} go={go} />}
    </I18n.Provider>
  );
}
