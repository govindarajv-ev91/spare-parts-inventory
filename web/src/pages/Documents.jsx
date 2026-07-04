import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import './Pages.css'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function invoiceUrl(path) {
  if (!path) return null
  const { data } = supabase.storage.from('stock-invoices').getPublicUrl(path)
  return data?.publicUrl || null
}

function itemStats(items = []) {
  const count = items.length
  const totalQty = items.reduce((sum, row) => sum + (Number(row.qty) || 0), 0)
  return { count, totalQty }
}

export default function Documents() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterHub, setFilterHub] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')

  const fetchDocuments = async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('stock_requests')
      .select('*, stock_request_items(*)')
      .not('invoice_path', 'is', null)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
      setRequests([])
    } else {
      setRequests(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  const hubs = useMemo(
    () => [...new Set(requests.map((r) => r.hub_name).filter(Boolean))].sort(),
    [requests]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return requests.filter((r) => {
      const matchHub = !filterHub || r.hub_name === filterHub
      const matchStatus = filterStatus === 'all' || r.status === filterStatus
      const matchSearch =
        !q ||
        r.hub_name?.toLowerCase().includes(q) ||
        r.city?.toLowerCase().includes(q) ||
        r.invoice_name?.toLowerCase().includes(q) ||
        r.submitted_by?.toLowerCase().includes(q)
      return matchHub && matchStatus && matchSearch
    })
  }, [requests, filterHub, filterStatus, search])

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        const { count, totalQty } = itemStats(r.stock_request_items)
        acc.docs += 1
        acc.items += count
        acc.qty += totalQty
        return acc
      },
      { docs: 0, items: 0, qty: 0 }
    )
  }, [filtered])

  const handleDownload = (r) => {
    const url = invoiceUrl(r.invoice_path)
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noreferrer'
    a.download = r.invoice_name || 'invoice'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const exportListCsv = () => {
    if (filtered.length === 0) return
    const headers = [
      'Date',
      'Time',
      'HUB',
      'City',
      'Type',
      'Status',
      'Item Count',
      'Total Qty',
      'Invoice Name',
      'Submitted By',
    ]
    const rows = filtered.map((r) => {
      const d = new Date(r.created_at)
      const { count, totalQty } = itemStats(r.stock_request_items)
      return [
        d.toLocaleDateString(),
        d.toLocaleTimeString(),
        r.hub_name,
        r.city,
        r.request_type,
        r.status,
        count,
        totalQty,
        r.invoice_name || '',
        r.submitted_by || '',
      ]
    })
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `uploaded-documents-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page">
      <div className="stats-grid">
        <div className="stat-card stat-blue">
          <span className="stat-label">Documents</span>
          <strong className="stat-value">{totals.docs}</strong>
          <span className="stat-sub">Uploaded invoices</span>
        </div>
        <div className="stat-card stat-green">
          <span className="stat-label">Item Count</span>
          <strong className="stat-value">{totals.items}</strong>
          <span className="stat-sub">Across filtered docs</span>
        </div>
        <div className="stat-card stat-orange">
          <span className="stat-label">Total Qty</span>
          <strong className="stat-value">{totals.qty}</strong>
          <span className="stat-sub">Sum of all line qty</span>
        </div>
      </div>

      <section className="card dash-card">
        <div className="card-toolbar">
          <h3>Uploaded Documents</h3>
          <div className="toolbar-filters">
            <input
              type="search"
              placeholder="Search HUB, city, file…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            <select value={filterHub} onChange={(e) => setFilterHub(e.target.value)}>
              <option value="">All HUBs</option>
              {hubs.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <button
              type="button"
              className="btn-export-outline"
              onClick={exportListCsv}
              disabled={filtered.length === 0}
            >
              Export List CSV
            </button>
            <button type="button" className="btn-secondary" onClick={fetchDocuments}>
              Refresh
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <p className="muted">Loading documents…</p>
        ) : filtered.length === 0 ? (
          <p className="muted">
            No uploaded documents yet. HUB bulk uploads with invoice attachments will appear here.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>HUB</th>
                  <th>City</th>
                  <th>Type</th>
                  <th>Item Count</th>
                  <th>Total Qty</th>
                  <th>Status</th>
                  <th>Document</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const { count, totalQty } = itemStats(r.stock_request_items)
                  const url = invoiceUrl(r.invoice_path)
                  return (
                    <tr key={r.id}>
                      <td className="nowrap">{formatDate(r.created_at)}</td>
                      <td><strong>{r.hub_name}</strong></td>
                      <td>{r.city}</td>
                      <td>{r.request_type}</td>
                      <td>{count}</td>
                      <td><strong>{totalQty}</strong></td>
                      <td>
                        <span className={`status-badge status-${r.status}`}>{r.status}</span>
                      </td>
                      <td>{r.invoice_name || 'invoice'}</td>
                      <td>
                        {url ? (
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleDownload(r)}
                          >
                            Download
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
