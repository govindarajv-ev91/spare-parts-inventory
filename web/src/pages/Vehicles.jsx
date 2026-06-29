import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { fetchAllRows, fetchCount } from '../utils/supabaseFetchAll'
import './Pages.css'

const ROWS_PER_PAGE = 50

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadProgress, setLoadProgress] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const fetchVehicles = async () => {
    setLoading(true)
    setError('')
    setLoadProgress('Counting…')

    try {
      const count = await fetchCount(supabase, 'vehicle_master')
      setTotalCount(count)
      setLoadProgress(`Loading 0 / ${count}…`)

      const all = await fetchAllRows(
        supabase,
        'vehicle_master',
        'id, vehicle_number, chassis_number, engine_motor_number, month, master_date, created_at',
        'vehicle_number',
        true,
        (loaded) => setLoadProgress(`Loading ${loaded} / ${count}…`)
      )

      setVehicles(all)
      setLoadProgress('')
    } catch (err) {
      setError(err.message)
      setVehicles([])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchVehicles()
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return vehicles
    return vehicles.filter(
      (v) =>
        v.vehicle_number?.toLowerCase().includes(q) ||
        v.chassis_number?.toLowerCase().includes(q) ||
        v.engine_motor_number?.toLowerCase().includes(q)
    )
  }, [vehicles, search])

  useEffect(() => {
    setPage(1)
  }, [search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))
  const paged = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)

  return (
    <div className="page">
      <div className="stats-grid">
        <div className="stat-card stat-green">
          <span className="stat-label">Total Vehicles</span>
          <strong className="stat-value">{totalCount || vehicles.length}</strong>
          <span className="stat-sub">In vehicle_master database</span>
        </div>
        <div className="stat-card stat-blue">
          <span className="stat-label">Loaded</span>
          <strong className="stat-value">{vehicles.length}</strong>
          <span className="stat-sub">All records fetched</span>
        </div>
        <div className="stat-card stat-orange">
          <span className="stat-label">Showing</span>
          <strong className="stat-value">{filtered.length}</strong>
          <span className="stat-sub">{search ? 'Search results' : 'All vehicles'}</span>
        </div>
      </div>

      <section className="card dash-card">
        <div className="card-toolbar">
          <h3>Vehicle Master List</h3>
          <div className="toolbar-filters">
            <input
              type="search"
              placeholder="Search vehicle, chassis, engine…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            <button type="button" className="btn-secondary" onClick={fetchVehicles}>Refresh</button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {loading && (
          <p className="muted">{loadProgress || 'Loading all vehicles…'}</p>
        )}

        {!loading && filtered.length === 0 && (
          <p className="muted">No vehicles found.</p>
        )}

        {!loading && paged.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Vehicle Number</th>
                    <th>Chassis Number</th>
                    <th>Engine / Motor</th>
                    <th>Month</th>
                    <th>Master Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((v, i) => (
                    <tr key={v.id}>
                      <td className="muted">{(page - 1) * ROWS_PER_PAGE + i + 1}</td>
                      <td><code>{v.vehicle_number}</code></td>
                      <td>{v.chassis_number || '—'}</td>
                      <td>{v.engine_motor_number || '—'}</td>
                      <td>{v.month || '—'}</td>
                      <td className="nowrap">{v.master_date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                type="button"
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Previous
              </button>
              <span className="pagination-info">
                Page {page} of {totalPages} · Showing {paged.length} of {filtered.length}
              </span>
              <button
                type="button"
                className="btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
