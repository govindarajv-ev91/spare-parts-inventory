import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { exportHistoryCsv, exportHistoryExcel } from '../utils/exportHistory'
import './Pages.css'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function History() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterHub, setFilterHub] = useState('')
  const [search, setSearch] = useState('')

  const fetchHistory = async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('usage_history')
      .select('*')
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
      setRecords([])
    } else {
      setRecords(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchHistory()

    const channel = supabase
      .channel('usage_history_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'usage_history' }, () => {
        fetchHistory()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const hubs = [...new Set(records.map((r) => r.hub_name))].sort()

  const filtered = records.filter((r) => {
    const matchHub = !filterHub || r.hub_name === filterHub
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      r.item_code.toLowerCase().includes(q) ||
      r.item_description.toLowerCase().includes(q) ||
      r.vehicle_number.toLowerCase().includes(q)
    return matchHub && matchSearch
  })

  const handleExportCsv = () => {
    if (filtered.length === 0) return
    exportHistoryCsv(filtered)
  }

  const handleExportExcel = () => {
    if (filtered.length === 0) return
    exportHistoryExcel(filtered)
  }

  return (
    <div className="page">
      <div className="stats-grid">
        <div className="stat-card stat-green">
          <span className="stat-label">Total Records</span>
          <strong className="stat-value">{records.length}</strong>
          <span className="stat-sub">Usage transactions</span>
        </div>
        <div className="stat-card stat-blue">
          <span className="stat-label">Showing</span>
          <strong className="stat-value">{filtered.length}</strong>
          <span className="stat-sub">Filtered results</span>
        </div>
        <div className="stat-card stat-orange">
          <span className="stat-label">Qty Used</span>
          <strong className="stat-value">{filtered.reduce((s, r) => s + r.qty_used, 0)}</strong>
          <span className="stat-sub">Total parts deducted</span>
        </div>
      </div>

      <section className="card dash-card">
        <div className="card-toolbar">
          <h3>All Transactions</h3>
          <div className="toolbar-filters">
            <input
              type="search"
              placeholder="Search item or vehicle…"
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
            <button
              type="button"
              className="btn-export"
              onClick={handleExportExcel}
              disabled={filtered.length === 0}
            >
              Export Excel
            </button>
            <button
              type="button"
              className="btn-export-outline"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
            >
              Export CSV
            </button>
            <button type="button" className="btn-secondary" onClick={fetchHistory}>
              Refresh
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <p className="muted">Loading history…</p>
        ) : filtered.length === 0 ? (
          <p className="muted">No usage records yet. Deductions from the Android app will appear here.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Item Code</th>
                  <th>Description</th>
                  <th>HUB</th>
                  <th>Qty Used</th>
                  <th>Before → After</th>
                  <th>Vehicle No.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap">{formatDate(r.created_at)}</td>
                    <td><code>{r.item_code}</code></td>
                    <td>{r.item_description}</td>
                    <td>{r.hub_name}</td>
                    <td><span className="qty-used">−{r.qty_used}</span></td>
                    <td>{r.qty_before} → {r.qty_after}</td>
                    <td><strong>{r.vehicle_number}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
