'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, ChevronDown, LoaderCircle, Plus, Trash2, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export const WorkspaceMenu = ({ workspaces, activeId, onChange }: {
  workspaces: { id: string; name: string }[];
  activeId: string;
  onChange: (id: string) => Promise<void>;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<'create' | 'delete' | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = workspaces.find((workspace) => workspace.id === activeId);
  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (dialog === 'create') {
        const created = await apiClient.createWorkspace(name.trim());
        await onChange(created.id);
      } else {
        await apiClient.deleteWorkspace(activeId);
        const remaining = await apiClient.workspaces();
        await onChange(remaining[0].id);
      }
      setDialog(null); setName('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update workspace.'); }
    finally { setBusy(false); }
  };
  return <>
    <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <Popover.Trigger className="workspace-pill" aria-label="Switch workspace">
        <span className="workspace-avatar">{active?.name.slice(0, 1).toUpperCase() ?? 'W'}</span>
        <span className="workspace-name">{active?.name ?? 'Workspace'}</span><ChevronDown size={14} />
      </Popover.Trigger>
      <Popover.Portal><Popover.Content className="workspace-menu" align="start" sideOffset={12}>
        <span className="nav-label">WORKSPACES</span>
        {workspaces.map((workspace) => <button key={workspace.id} className="workspace-option"
          onClick={() => { setMenuOpen(false); void onChange(workspace.id); }}>
          <span>{workspace.name}</span>{workspace.id === activeId && <Check size={14} />}
        </button>)}
        <div className="menu-divider" />
        <button className="workspace-option" onClick={() => {
          setMenuOpen(false); setError(''); setDialog('create');
        }}><Plus size={15} />New workspace</button>
        <button className="workspace-option danger-text" onClick={() => {
          setMenuOpen(false); setError(''); setDialog('delete');
        }}><Trash2 size={14} />Delete workspace</button>
      </Popover.Content></Popover.Portal>
    </Popover.Root>
    <Dialog.Root open={dialog !== null} onOpenChange={(open) => { if (!open && !busy) setDialog(null); }}>
      <Dialog.Portal><Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content settings-dialog">
          <Dialog.Close className="icon-button dialog-close" aria-label="Close workspace dialog" disabled={busy}><X size={18} /></Dialog.Close>
          <Dialog.Title>{dialog === 'create' ? 'New workspace' : 'Delete workspace?'}</Dialog.Title>
          <Dialog.Description className="muted">
            {dialog === 'create' ? 'Start fresh with a separate set of subscriptions.' :
              `This permanently deletes “${active?.name}”, its subscriptions, analysis and SSO logs. Other workspaces are kept.`}
          </Dialog.Description>
          <form className="settings-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            {dialog === 'create' && <label>Workspace name<input autoFocus maxLength={80}
              placeholder="e.g. UCL Research" value={name} onChange={(event) => setName(event.target.value)} /></label>}
            {error && <p className="inline-error" role="alert">{error}</p>}
            <button className={`button ${dialog === 'delete' ? 'danger-button' : 'primary'}`}
              disabled={busy || (dialog === 'create' && !name.trim())}>
              {busy ? <LoaderCircle size={15} className="spin" /> : dialog === 'delete' ? <Trash2 size={15} /> : <Plus size={15} />}
              {dialog === 'create' ? 'Create workspace' : 'Delete workspace'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
};
