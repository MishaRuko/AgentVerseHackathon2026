'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import Fuse from 'fuse.js';
import Link from 'next/link';
import { ArrowDownRight, ArrowRight, Check, ChevronDown, CircleHelp, FilePlus2, KeyRound,
  LayoutGrid, LoaderCircle, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { Filters, Workspace } from '@/lib/schemas';
import { Brand } from './brand';
import { UploadPanel } from './upload-panel';
import { money, statusLabels, SubscriptionCard } from './subscription-card';
import { ServiceDetail } from './service-detail';

const EMPTY_FILTERS: Filters = { query: '', category: 'All', status: 'All', savings_only: false };

export const WorkspaceApp = () => {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [token, setToken] = useState('');
  const [chat, setChat] = useState('');
  const [chatResult, setChatResult] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const refresh = useCallback(async () => {
    const data = await apiClient.workspace(); setWorkspace(data); setError('');
  }, []);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { const data = await apiClient.workspace(); if (alive) { setWorkspace(data); setError(''); } }
      catch (err) { if (alive) setError(err instanceof Error ? err.message : 'Could not connect to workspace.'); }
      if (alive) timer = setTimeout(poll, 2500);
    };
    void poll();
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await action(); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };
  const upload = async (files: File[]) => {
    await run(async () => {
      const result = await apiClient.upload(files);
      setNotice(`Imported ${result.imported} subscriptions.${result.warnings.length ? ` ${result.warnings.join(' ')}` : ' Research is now queued.'}`);
      setUploadOpen(false);
    });
  };
  const services = workspace?.services ?? [];
  const selected = services.find((service) => service.id === selectedId);
  const currencies = [...new Set(services.map((service) => service.currency))];
  const categories = [...new Set(services.map((service) => service.category))].sort();
  const suggestions = services.filter((service) => service.status === 'suggestion').length;
  const missing = services.filter((service) => service.users === null).length;
  const filtered = useMemo(() => {
    const list = workspace?.services ?? [];
    const searched = filters.query ? new Fuse(list, { keys: ['name'], threshold: 0.38 })
      .search(filters.query).map(({ item }) => item) : list;
    return searched.filter((service) => (filters.category === 'All' || service.category === filters.category)
      && (filters.status === 'All' || service.status === filters.status)
      && (!filters.savings_only || (service.savings ?? 0) > 0));
  }, [workspace, filters]);
  const activeFilters = filters.query || filters.category !== 'All' || filters.status !== 'All' || filters.savings_only;
  const savings = (currency: string) => services.filter((service) => service.currency === currency)
    .reduce((sum, service) => sum + (service.savings ?? 0), 0);

  return <div className="app-shell">
    <header className="app-header"><Link href="/" className="brand-link" aria-label="byebye.fyi home"><Brand /></Link>
      <div className="workspace-pill"><span className="workspace-avatar">W</span> My workspace<ChevronDown size={12} /></div>
      <div className="header-actions"><span className="private-label"><ShieldCheck size={13} />Private workspace</span>
        <button className="icon-button" aria-label="Help" onClick={() => setHelpOpen(true)}><CircleHelp size={18} /></button>
        <button className="icon-button" aria-label="Settings" onClick={() => setSettingsOpen(true)}><Settings size={18} /></button>
        <span className="user-avatar" aria-label="Workspace user">M</span></div></header>
    {error && <div className="notice error global-notice" role="alert">{error}<button className="text-link" onClick={() => setSettingsOpen(true)}>Settings<ArrowRight size={13} /></button></div>}
    {notice && <div className="notice global-notice" role="status">{notice}<button className="icon-button" aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={15} /></button></div>}
    {workspace === null ? <main className="loading-workspace"><LoaderCircle className="spin" size={24} /><p>{error ? 'Waiting for your workspace…' : 'Getting your workspace ready…'}</p><span>Make sure the API and worker are running.</span></main> : services.length === 0 ?
      <main className="welcome-main"><UploadPanel onUpload={upload} onDemo={() => void run(() => apiClient.demo())} busy={busy} /></main> :
      <div className="workspace-body"><aside className="sidebar"><span className="nav-label">WORKSPACE</span>
        <button className="nav-item active" onClick={() => setFilters(EMPTY_FILTERS)}><LayoutGrid size={16} />Subscriptions<span>{services.length}</span></button>
        <button className={`nav-item ${filters.savings_only ? 'selected' : ''}`} onClick={() => setFilters({ ...EMPTY_FILTERS, savings_only: true })}><ArrowDownRight size={17} />Opportunities<span>{suggestions}</span></button>
        <div className="sidebar-divider" /><span className="nav-label">CONNECTIONS</span>
        <button className="nav-item" onClick={() => setHelpOpen(true)}><KeyRound size={16} />SSO connector<span className="mock-dot" /></button>
        <div className="sidebar-bottom"><div className="sidebar-note"><Sparkles size={18} /><strong>A little less waste.<br />A lot more possibility.</strong><p>Better decisions start with a clearer picture.</p></div>
          <span className="sidebar-version">byebye.fyi <span>EARLY ACCESS</span></span></div></aside>
        <main className="dashboard"><div className="page-heading"><div><span className="eyebrow">YOUR STACK, RIGHT-SIZED</span><h1>Subscriptions<span className="title-dot">.</span></h1><p>A clearer view of what you use. A smarter way to spend.</p></div>
          <button className="button" onClick={() => setUploadOpen(true)}><FilePlus2 size={16} />Add subscriptions</button></div>
          {services.some((service) => service.demo) && <div className="demo-banner"><Sparkles size={14} /><span>You’re exploring demo data. All prices are illustrative; SSO logs are synthetic.</span><span className="demo-badge">DEMO WORKSPACE</span></div>}
          {!workspace.ai_configured && !services.every((service) => service.demo) && <div className="notice">Live research needs a Gemini API key. Add it to .env and restart the API and worker.</div>}
          <section className="stats-grid" aria-label="Subscription overview"><div className="stat-card"><span className="metric-label">SUBSCRIPTIONS TRACKED<LayoutGrid size={15} /></span><strong>{services.length.toString().padStart(2, '0')}</strong><span className="stat-caption">All your tools, one place</span></div>
            <div className="stat-card"><span className="metric-label">CURRENT MONTHLY SPEND<span>↗</span></span><strong className={currencies.length > 1 ? 'multi-currency' : ''}>{currencies.map((currency) => <span key={currency}>{money(services.filter((s) => s.currency === currency).reduce((sum, s) => sum + (s.spend ?? 0), 0), currency)}</span>)}</strong><span className="stat-caption">{services.filter((s) => s.spend !== null).length} of {services.length} subscriptions have spend data</span></div>
            <div className="stat-card savings-stat"><span className="metric-label">POTENTIAL MONTHLY SAVINGS<ArrowDownRight size={16} /></span><strong className={currencies.length > 1 ? 'multi-currency' : ''}>{currencies.map((currency) => <span key={currency}>{money(savings(currency), currency)}</span>)}</strong><span className="stat-caption">{suggestions} opportunities to spend smarter</span><span className="stat-decoration" aria-hidden="true">↘</span></div></section>
          <section className="agent-strip"><div className={`agent-icon ${workspace.pending_jobs ? 'agent-running' : ''}`}><Sparkles size={18} /></div><div><strong>{workspace.pending_jobs ? `Your agent is on it. ${workspace.pending_jobs} tasks to go.` : missing ? 'Let’s fill in the missing pieces.' : 'Your stack is looking clearer.'}</strong>
            <p>{workspace.pending_jobs ? 'Research runs in the background. You can safely close this tab.' : missing ? `${missing} subscriptions need active user counts. Your mock SSO connector can help.` : 'Review the suggestions below. You’re always in control of what changes.'}</p></div>
            <button className="button small" disabled={busy || workspace.pending_jobs > 0} onClick={() => void run(() => apiClient.enrich())}><KeyRound size={14} />Fill gaps & analyse<ArrowRight size={14} /></button></section>
          <div className="list-heading"><h2>Your subscriptions <span className="count">{services.length}</span></h2><span className="subtle"><span className="little-dot green-dot" />{workspace.pending_jobs ? 'Analysis in progress' : 'Workspace up to date'}</span></div>
          <div className="filter-bar"><label className="search-input"><Search size={16} /><input placeholder="Find a subscription…" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} aria-label="Search subscriptions" /><kbd>⌕</kbd></label>
            <label className="select-control"><SlidersHorizontal size={14} /><select aria-label="Filter by category" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="All">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label className="select-control"><span className="little-dot" /><select aria-label="Filter by status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="All">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <Popover.Root><Popover.Trigger className="button ai-filter"><Sparkles size={15} />Ask AI to filter</Popover.Trigger><Popover.Portal><Popover.Content className="chat-popover" sideOffset={10} align="end">
              <div className="section-heading"><strong><Sparkles size={15} />A filter, in your words.</strong><Popover.Close className="icon-button" aria-label="Close AI filter"><X size={16} /></Popover.Close></div><p>Try “show design tools with potential savings”.</p>
              <form onSubmit={async (event) => { event.preventDefault(); setChatBusy(true); setChatResult('');
                try { setFilters(await apiClient.filter(chat)); setChatResult('Filters applied. Take a look at your subscriptions.'); }
                catch (err) { setChatResult(err instanceof Error ? err.message : 'Filter failed.'); } finally { setChatBusy(false); }
              }}><textarea value={chat} onChange={(event) => setChat(event.target.value)} maxLength={2000} placeholder="What would you like to see?" aria-label="Natural language filter request" />
                <button className="button primary" disabled={!chat.trim() || chatBusy}>{chatBusy ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />}Apply filter<ArrowRight size={14} /></button></form>
              {chatResult && <p role="status" className="chat-result">{chatResult}</p>}<Popover.Arrow className="popover-arrow" /></Popover.Content></Popover.Portal></Popover.Root></div>
          <div className="results-line"><span>Showing {filtered.length} of {services.length} subscriptions</span>{activeFilters && <button className="text-link" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters<X size={12} /></button>}<span className="results-hint">Select a card for the full picture<ArrowDownRight size={13} /></span></div>
          <div className="subscription-grid">{filtered.map((service) => <SubscriptionCard key={service.id} service={service} onOpen={() => setSelectedId(service.id)} onSso={() => void run(() => apiClient.sso(service.id))} disabled={busy} />)}</div>
          {!filtered.length && <div className="empty-results"><Search size={27} /><h3>No subscriptions match just yet.</h3><p>Try a different search or clear your filters.</p><button className="button" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button></div>}
          <div className="dashboard-footnote"><ShieldCheck size={13} />Recommendations, not automatic changes. You make the final call.</div>
        </main></div>}
    <footer className="app-footer"><span>Less waste. More possibility.</span><span>Made for a better-balanced stack.<span className="footer-spark">✳</span></span></footer>
    {selected && <ServiceDetail key={`${selected.id}-${selected.users}-${selected.spend}`} service={selected} busy={busy} onClose={() => setSelectedId(null)} onSso={() => void run(() => apiClient.sso(selected.id))} onRetry={() => void run(() => apiClient.retry(selected.id))} onEdit={(users, spend) => run(() => apiClient.edit(selected.id, users, spend))} />}
    <Dialog.Root open={uploadOpen} onOpenChange={setUploadOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content upload-dialog"><Dialog.Close className="icon-button dialog-close" aria-label="Close upload"><X size={18} /></Dialog.Close><Dialog.Title>Add to your stack</Dialog.Title><Dialog.Description className="muted">Upload a spreadsheet. We’ll take it from here.</Dialog.Description><UploadPanel compact onUpload={upload} busy={busy} /></Dialog.Content></Dialog.Portal></Dialog.Root>
    <Dialog.Root open={settingsOpen} onOpenChange={setSettingsOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content settings-dialog"><Dialog.Close className="icon-button dialog-close" aria-label="Close settings"><X size={18} /></Dialog.Close><Dialog.Title>Workspace settings</Dialog.Title><Dialog.Description className="muted">One private workspace. Your subscription data.</Dialog.Description>
      <form className="settings-form" onSubmit={(event) => { event.preventDefault(); sessionStorage.setItem('workspace-token', token); setSettingsOpen(false); void run(refresh); }}><label>Workspace access token<input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Enter APP_TOKEN" autoComplete="off" /></label><p className="fine-print">Only needed if APP_TOKEN is set on your server. Stored in this browser tab’s session, never in a public environment variable.</p><button className="button primary"><Check size={15} />Connect workspace</button></form>
      <div className="settings-status"><span><Sparkles size={14} />Gemini AI</span><b>{workspace?.ai_configured ? 'Configured' : 'Key not configured'}</b></div><div className="settings-status"><span><KeyRound size={14} />SSO connector</span><b>Synthetic logs · 7,000-user population</b></div>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
    <Dialog.Root open={helpOpen} onOpenChange={setHelpOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content settings-dialog"><Dialog.Close className="icon-button dialog-close" aria-label="Close help"><X size={18} /></Dialog.Close><Dialog.Title>A clearer picture of your stack.</Dialog.Title><Dialog.Description className="muted">How byebye.fyi works</Dialog.Description><div className="help-content"><h3>1. Bring your subscriptions</h3><p>Upload CSV or XLSX with a Service or Subscription name column. Users, Monthly spend, Currency and Category are optional. A Period column supports annual spend, normalised to monthly. Default currency is GBP.</p><a className="text-link" href="/sample-subscriptions.csv" download>Download a sample CSV<ArrowDownRight size={14} /></a><h3>2. Fill in the picture</h3><p>Gemini researches public pricing. For missing user counts, the mock SSO connector counts distinct successful logins over the last three calendar months. All generated identities and logs are synthetic.</p><h3>3. Find the right fit</h3><p>We compare user capacity and price, then explain the result. Savings exclude taxes, feature requirements and exit costs. Enterprise quotes may need manual review. No subscriptions are changed automatically.</p></div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
};
