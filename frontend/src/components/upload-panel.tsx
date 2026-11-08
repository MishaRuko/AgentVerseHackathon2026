'use client';

import { useRef, useState } from 'react';
import { ArrowRight, FileSpreadsheet, UploadCloud, X, LoaderCircle } from 'lucide-react';
import { Brand } from './brand';

export const UploadPanel = ({ onUpload, busy, compact = false }: {
  onUpload: (files: File[]) => Promise<boolean>; busy: boolean; compact?: boolean;
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const addFiles = (incoming: File[]) => {
    setError('');
    if (incoming.some((file) => !/\.(csv|xlsx)$/i.test(file.name) || file.size > 10 * 1024 * 1024)) {
      setError('Please choose CSV or XLSX files, up to 10 MB each.'); return;
    }
    setFiles((current) => [...current, ...incoming].slice(0, 10));
  };
  return <section className={`upload-intro ${compact ? 'compact' : ''}`}>
    {!compact && <><span className="eyebrow"><span className="little-dot" />THE SUBSCRIPTION CLEAN-UP CREW</span>
      <Brand large /><h1>Goodbye, wasted spend.<br /><span>Hello, better subscriptions.</span></h1>
      <p className="intro-copy">Your tools should work for you. Not the other way around.<br />Let’s find out what you actually need — and what you can let go.</p></>}
    <div className="upload-box-wrap">
      <div className={`upload-box ${dragging ? 'dragging' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)} onDrop={(event) => {
          event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files));
        }}>
        <input ref={input} type="file" accept=".csv,.xlsx" multiple className="sr-only"
          aria-label="Upload subscription spreadsheets" onChange={(event) => {
            addFiles(Array.from(event.target.files ?? [])); event.target.value = '';
          }} />
        <div className="upload-icon"><UploadCloud size={27} strokeWidth={1.5} /></div>
        <h2>Drop your subscription list here</h2>
        <p>or <button className="text-link" onClick={() => input.current?.click()} disabled={busy}>browse files</button> to get started</p>
        <span className="file-hint">XLSX or CSV · up to 10 MB per file</span>
        {files.length > 0 && <div className="file-list">{files.map((file, index) => <div className="file-item" key={`${file.name}-${index}`}>
          <FileSpreadsheet size={16} /><span>{file.name}</span><button aria-label={`Remove ${file.name}`} disabled={busy}
            onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}><X size={14} /></button>
        </div>)}</div>}
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button className="button primary process-button" disabled={!files.length || busy}
        onClick={async () => { if (await onUpload(files)) setFiles([]); }}>
        {busy ? <><LoaderCircle size={16} className="spin" />Processing your files…</> : <>Find my savings<ArrowRight size={17} /></>}
      </button>
    </div>
    {!compact && <div className="intro-steps"><span><b>01</b> Bring your subscriptions</span><span><b>02</b> We do the digging</span><span><b>03</b> You keep the savings</span></div>}
  </section>;
};
