// src/components/resume/ShareManager.tsx
'use client'
import { useState, useEffect } from 'react'
import { Link2, Copy, Trash2, Plus, Eye, Lock, Calendar, Loader2, Check } from 'lucide-react'
import { Button, Card } from '@/components/ui/primitives'
import { cn, formatDate } from '@/lib/utils'

interface Share {
  id: string
  slug: string
  viewCount: number
  expiresAt: string | null
  hasPassword: boolean
  createdAt: string
  url: string
}

export function ShareManager({ resumeId }: { resumeId: string }) {
  const [shares, setShares]     = useState<Share[]>([])
  const [loading, setLoading]   = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [password, setPassword] = useState('')
  const [expireDays, setExpire] = useState('')
  const [copied, setCopied]     = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/share?resumeId=${resumeId}`)
      .then(r => r.json())
      .then(d => setShares(d.shares ?? []))
      .finally(() => setLoading(false))
  }, [resumeId])

  async function createShare() {
    setCreating(true)
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId,
          password: password || undefined,
          expiresInDays: expireDays ? parseInt(expireDays) : undefined,
        }),
      })
      const data = await res.json()
      setShares(p => [{ ...data.share, url: data.url }, ...p])
      setShowForm(false); setPassword(''); setExpire('')
    } catch { /* ignore */ }
    setCreating(false)
  }

  async function revokeShare(id: string) {
    await fetch(`/api/share?id=${id}`, { method: 'DELETE' })
    setShares(p => p.filter(s => s.id !== id))
  }

  async function copyUrl(url: string, id: string) {
    await navigator.clipboard.writeText(url)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link2 size={14} className="text-violet-400" />
          <span className="font-semibold text-sm">Share Resume</span>
        </div>
        <Button size="sm" variant="primary" onClick={() => setShowForm(v => !v)}>
          <Plus size={12} />New Link
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="mb-4 fade-in">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">New Share Link</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block flex items-center gap-1"><Lock size={10}/>Password (optional)</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Leave blank for public"
                className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block flex items-center gap-1"><Calendar size={10}/>Expires in (days)</label>
              <input type="number" value={expireDays} onChange={e => setExpire(e.target.value)}
                placeholder="Never"
                className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={createShare} loading={creating}>
              Create Link
            </Button>
            <Button size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Share list */}
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={18} className="spin text-slate-600" /></div>
      ) : shares.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-white/8 rounded-xl">
          <Link2 size={28} className="text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500 mb-1">No share links yet</p>
          <p className="text-xs text-slate-600">Create a link to share this resume publicly or with a password.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shares.map(share => (
            <div key={share.id} className="bg-[#1c1c24] border border-white/8 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3 mb-2">
                <code className="flex-1 text-xs text-violet-300 truncate font-mono bg-violet-500/8 px-2 py-1 rounded">
                  {share.url}
                </code>
                <button onClick={() => copyUrl(share.url, share.id)}
                  className={cn('shrink-0 text-xs flex items-center gap-1 px-2 py-1 rounded transition-all',
                    copied === share.id
                      ? 'text-emerald-400 bg-emerald-400/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5')}>
                  {copied === share.id ? <><Check size={11}/>Copied</> : <><Copy size={11}/>Copy</>}
                </button>
                <button onClick={() => revokeShare(share.id)}
                  className="shrink-0 text-slate-600 hover:text-red-400 transition-colors p-1">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Eye size={10}/>{share.viewCount} view{share.viewCount !== 1 ? 's' : ''}</span>
                {share.hasPassword && <span className="flex items-center gap-1"><Lock size={10}/>Password protected</span>}
                {share.expiresAt
                  ? <span className="flex items-center gap-1"><Calendar size={10}/>Expires {formatDate(share.expiresAt)}</span>
                  : <span>Never expires</span>}
                <span>Created {formatDate(share.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
