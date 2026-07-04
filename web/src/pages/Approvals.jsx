import { useState, useEffect, Fragment } from 'react'
import { supabase } from '../supabaseClient'
import './Pages.css'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function Approvals() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filter, setFilter] = useState('pending')
  const [busyId, setBusyId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  const fetchRequests = async () => {
    setLoading(true)
    setError('')
    let query = supabase
      .from('stock_requests')
      .select('*, stock_request_items(*)')
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data, error: err } = await query
    if (err) {
      setError(err.message)
      setRequests([])
    } else {
      setRequests(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchRequests()
  }, [filter])

  const invoiceUrl = (path) => {
    if (!path) return null
    const { data } = supabase.storage.from('stock-invoices').getPublicUrl(path)
    return data?.publicUrl || null
  }

  const handleApprove = async (id) => {
    setBusyId(id)
    setError('')
    setSuccess('')
    const { error: err } = await supabase.rpc('approve_stock_request', {
      p_request_id: id,
    })
    setBusyId(null)
    if (err) {
      setError(err.message)
    } else {
      setSuccess('Request approved. Stock has been loaded into inventory.')
      fetchRequests()
    }
  }

  const handleReject = async (id) => {
    const reason = window.prompt('Reject reason (optional):') ?? ''
    setBusyId(id)
    setError('')
    setSuccess('')
    const { error: err } = await supabase.rpc('reject_stock_request', {
      p_request_id: id,
      p_reason: reason || null,
    })
    setBusyId(null)
    if (err) {
      setError(err.message)
    } else {
      setSuccess('Request rejected.')
      fetchRequests()
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  return (
    <div className="page">
      <div className="stats-grid">
        <div className="stat-card stat-orange">
          <span className="stat-label">Showing</span>
          <strong className="stat-value">{requests.length}</strong>
          <span className="stat-sub">Stock requests</span>
        </div>
        {filter === 'pending' && (
          <div className="stat-card stat-red">
            <span className="stat-label">Pending</span>
            <strong className="stat-value">{pendingCount}</strong>
            <span className="stat-sub">Need your approval</span>
          </div>
        )}
      </div>

      <section className="card dash-card">
        <div className="card-toolbar">
          <h3>Stock Approval Queue</h3>
          <div className="toolbar-filters">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
            <button type="button" className="btn-secondary" onClick={fetchRequests}>
              Refresh
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {loading ? (
          <p className="muted">Loading requests…</p>
        ) : requests.length === 0 ? (
          <p className="muted">No stock requests in this filter.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>HUB</th>
                  <th>City</th>
                  <th>Type</th>
                  <th>Items</th>
                  <th>Submitted by</th>
                  <th>Invoice</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const url = invoiceUrl(r.invoice_path)
                  const items = r.stock_request_items || []
                  const open = expandedId === r.id
                  return (
                    <Fragment key={r.id}>
                      <tr>
                        <td className="nowrap">{formatDate(r.created_at)}</td>
                        <td><strong>{r.hub_name}</strong></td>
                        <td>{r.city}</td>
                        <td>{r.request_type}</td>
                        <td>{items.length}</td>
                        <td>{r.submitted_by}</td>
                        <td>
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer" className="link-doc">
                              {r.invoice_name || 'View document'}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <span className={`status-badge status-${r.status}`}>{r.status}</span>
                        </td>
                        <td className="approval-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setExpandedId(open ? null : r.id)}
                          >
                            {open ? 'Hide' : 'Items'}
                          </button>
                          {r.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                className="btn-primary"
                                disabled={busyId === r.id}
                                onClick={() => handleApprove(r.id)}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn-danger-sm"
                                disabled={busyId === r.id}
                                onClick={() => handleReject(r.id)}
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                      {open && (
                        <tr className="expand-row">
                          <td colSpan={9}>
                            <table className="data-table inner-table">
                              <thead>
                                <tr>
                                  <th>Item Code</th>
                                  <th>Description</th>
                                  <th>Qty</th>
                                  <th>City</th>
                                  <th>HUB</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item) => (
                                  <tr key={item.id}>
                                    <td><code>{item.item_code}</code></td>
                                    <td>{item.item_description}</td>
                                    <td>{item.qty}</td>
                                    <td>{item.city}</td>
                                    <td>{item.hub_name}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {r.reject_reason && (
                              <p className="muted">Reject reason: {r.reject_reason}</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
