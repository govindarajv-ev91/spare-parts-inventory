import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { getSession, isAdmin, isHubUser } from '../auth'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import AddCityHubModal from '../components/AddCityHubModal'
import { parseCsv, parseExcel, downloadExcelTemplate } from '../utils/uploadParser'
import { exportInventoryCsv, exportInventoryExcel } from '../utils/exportInventory'
import './Pages.css'
import '../components/Modal.css'

const emptyForm = {
  item_code: '',
  item_description: '',
  qty: '',
  city_id: '',
  hub_id: '',
}

export default function Dashboard() {
  const session = getSession()
  const admin = isAdmin()
  const hubUser = isHubUser()

  const [items, setItems] = useState([])
  const [cities, setCities] = useState([])
  const [hubs, setHubs] = useState([])
  const [myRequests, setMyRequests] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [mode, setMode] = useState('manual')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filterHub, setFilterHub] = useState(hubUser ? session?.hubName || '' : '')
  const [search, setSearch] = useState('')
  const [deleteItem, setDeleteItem] = useState(null)
  const [addModal, setAddModal] = useState(null)
  const [invoiceFile, setInvoiceFile] = useState(null)

  const fetchCities = async () => {
    const { data } = await supabase.from('cities').select('*').order('name')
    setCities(data || [])
  }

  const fetchHubs = async () => {
    const { data } = await supabase
      .from('hubs')
      .select('*, cities(name)')
      .order('name')
    setHubs(data || [])
  }

  const fetchItems = async () => {
    setLoading(true)
    setError('')
    let query = supabase
      .from('inventory')
      .select('*')
      .order('hub_name')
      .order('item_code')

    if (hubUser && session?.hubName) {
      query = query.eq('hub_name', session.hubName)
    }

    const { data, error: err } = await query

    if (err) {
      setError(err.message)
      setItems([])
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  const fetchMyRequests = async () => {
    if (!hubUser || !session?.hubName) {
      setMyRequests([])
      return
    }
    const { data } = await supabase
      .from('stock_requests')
      .select('*, stock_request_items(*)')
      .eq('hub_name', session.hubName)
      .order('created_at', { ascending: false })
      .limit(20)
    setMyRequests(data || [])
  }

  const loadAll = async () => {
    await Promise.all([fetchCities(), fetchHubs(), fetchItems(), fetchMyRequests()])
  }

  useEffect(() => {
    if (hubUser && session?.cityId && session?.hubId) {
      setForm((f) => ({
        ...f,
        city_id: session.cityId,
        hub_id: session.hubId,
      }))
      setFilterHub(session.hubName || '')
    }
    loadAll()
  }, [])

  const hubsForCity = useMemo(() => {
    if (!form.city_id) return []
    return hubs.filter((h) => h.city_id === form.city_id)
  }, [hubs, form.city_id])

  const selectedCity = cities.find((c) => c.id === form.city_id)
  const selectedHub = hubs.find((h) => h.id === form.hub_id)

  const allHubNames = [...new Set(items.map((i) => i.hub_name))].sort()

  const filtered = items.filter((item) => {
    const matchHub = !filterHub || item.hub_name === filterHub
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      item.item_code.toLowerCase().includes(q) ||
      item.item_description.toLowerCase().includes(q)
    return matchHub && matchSearch
  })

  const lowStockItems = useMemo(
    () => items.filter((i) => i.qty <= 10).sort((a, b) => a.qty - b.qty),
    [items]
  )

  const handleChange = (e) => {
    const { name, value } = e.target
    if (hubUser && (name === 'city_id' || name === 'hub_id')) return
    if (name === 'city_id') {
      setForm((f) => ({ ...f, city_id: value, hub_id: '' }))
    } else {
      setForm((f) => ({ ...f, [name]: value }))
    }
  }

  const saveStockDirect = async (itemCode, itemDesc, qty, cityName, hubName) => {
    return supabase.from('inventory').upsert(
      {
        item_code: itemCode,
        item_description: itemDesc,
        qty,
        city: cityName,
        hub_name: hubName,
      },
      { onConflict: 'item_code,hub_name' }
    )
  }

  const uploadInvoice = async (file, requestId) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const path = `${requestId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('stock-invoices')
      .upload(path, file, { upsert: false })
    if (upErr) throw upErr
    return { path, name: file.name }
  }

  const submitForApproval = async ({
    requestType,
    cityName,
    hubName,
    hubId,
    items: requestItems,
    invoice,
  }) => {
    const submittedBy = hubUser
      ? `hub:${session.hubName}`
      : `admin:${session?.displayName || 'Admin'}`

    const { data: req, error: reqErr } = await supabase
      .from('stock_requests')
      .insert({
        request_type: requestType,
        status: 'pending',
        hub_id: hubId || null,
        hub_name: hubName,
        city: cityName,
        submitted_by: submittedBy,
      })
      .select('id')
      .single()

    if (reqErr) throw reqErr

    let invoicePath = null
    let invoiceName = null
    if (invoice) {
      const uploaded = await uploadInvoice(invoice, req.id)
      invoicePath = uploaded.path
      invoiceName = uploaded.name
      const { error: invErr } = await supabase
        .from('stock_requests')
        .update({ invoice_path: invoicePath, invoice_name: invoiceName })
        .eq('id', req.id)
      if (invErr) throw invErr
    }

    const rows = requestItems.map((row) => ({
      request_id: req.id,
      item_code: row.item_code,
      item_description: row.item_description,
      qty: row.qty,
      city: row.city,
      hub_name: row.hub_name,
    }))

    const { error: itemsErr } = await supabase.from('stock_request_items').insert(rows)
    if (itemsErr) throw itemsErr

    return req.id
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const qty = parseInt(form.qty, 10)
    if (!form.item_code.trim() || !form.item_description.trim()) {
      setError('Item Code, Description and Qty are required')
      return
    }
    if (isNaN(qty) || qty < 0) {
      setError('Qty must be a valid number (0 or more)')
      return
    }

    const cityName = hubUser ? session?.cityName : selectedCity?.name
    const hubName = hubUser ? session?.hubName : selectedHub?.name
    const hubId = hubUser ? session?.hubId : selectedHub?.id

    if (!hubUser && (!form.city_id || !form.hub_id)) {
      setError('City and HUB are required')
      return
    }
    if (!cityName || !hubName) {
      setError(hubUser ? 'HUB session is missing. Please log in again.' : 'City and HUB are required')
      return
    }

    setSaving(true)
    try {
      if (hubUser) {
        await submitForApproval({
          requestType: 'manual',
          cityName,
          hubName,
          hubId,
          items: [
            {
              item_code: form.item_code.trim(),
              item_description: form.item_description.trim(),
              qty,
              city: cityName,
              hub_name: hubName,
            },
          ],
        })
        setSuccess('Submitted for Admin approval. Stock will load after approval.')
        setForm({
          ...emptyForm,
          city_id: session.cityId,
          hub_id: session.hubId,
        })
        fetchMyRequests()
      } else {
        const { error: err } = await saveStockDirect(
          form.item_code.trim(),
          form.item_description.trim(),
          qty,
          cityName,
          hubName
        )
        if (err) throw err
        setSuccess('Stock saved successfully')
        setForm(emptyForm)
        fetchItems()
      }
    } catch (ex) {
      setError(ex.message || 'Failed to save')
    }
    setSaving(false)
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setSuccess('')

    if (hubUser && !invoiceFile) {
      setError('Please attach invoice / document copy before bulk upload')
      e.target.value = ''
      return
    }

    setUploading(true)

    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let rows = []

      if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer()
        rows = parseExcel(buffer)
      } else {
        const text = await file.text()
        rows = parseCsv(text)
      }

      if (rows.length === 0) throw new Error('File has no data rows')

      const defaultCity = selectedCity?.name || session?.cityName
      const defaultHub = selectedHub?.name || session?.hubName
      const defaultHubId = selectedHub?.id || session?.hubId

      const validRows = []
      let fail = 0

      for (const row of rows) {
        if (!row.item_code || !row.item_description || isNaN(row.qty) || row.qty < 0) {
          fail++
          continue
        }
        let cityName = row.city || defaultCity
        let hubName = row.hub_name || defaultHub

        if (hubUser) {
          cityName = session.cityName
          hubName = session.hubName
        }

        if (!cityName || !hubName) {
          fail++
          continue
        }

        validRows.push({
          item_code: row.item_code,
          item_description: row.item_description,
          qty: row.qty,
          city: cityName,
          hub_name: hubName,
        })
      }

      if (validRows.length === 0) {
        throw new Error(`No valid rows to upload (${fail} skipped)`)
      }

      if (hubUser) {
        await submitForApproval({
          requestType: 'bulk',
          cityName: session.cityName,
          hubName: session.hubName,
          hubId: defaultHubId,
          items: validRows,
          invoice: invoiceFile,
        })
        setSuccess(
          `Bulk upload submitted for Admin approval: ${validRows.length} item(s), ${fail} skipped. Stock loads after approval.`
        )
        setInvoiceFile(null)
        fetchMyRequests()
      } else {
        let ok = 0
        for (const row of validRows) {
          const { error: err } = await saveStockDirect(
            row.item_code,
            row.item_description,
            row.qty,
            row.city,
            row.hub_name
          )
          if (err) fail++
          else ok++
        }
        setSuccess(`Upload complete: ${ok} saved, ${fail} skipped`)
        fetchItems()
      }
    } catch (ex) {
      setError(ex.message)
    }
    setUploading(false)
    e.target.value = ''
  }

  const handleSaveCity = async (name) => {
    const { error: err } = await supabase.from('cities').insert({ name })
    if (err) return err.message
    await fetchCities()
    return null
  }

  const handleSaveHub = async (cityId, name, password) => {
    const payload = { city_id: cityId, name }
    if (password) payload.password = password
    const { error: err } = await supabase.from('hubs').insert(payload)
    if (err) return err.message
    await fetchHubs()
    return null
  }

  const handleConfirmDelete = async (id) => {
    const { error: err } = await supabase.from('inventory').delete().eq('id', id)
    setDeleteItem(null)
    if (err) setError(err.message)
    else {
      setSuccess('Item deleted successfully')
      fetchItems()
    }
  }

  return (
    <div className="page">
      <div className="stats-grid">
        <div className="stat-card stat-green">
          <span className="stat-label">Total Items</span>
          <strong className="stat-value">{items.length}</strong>
          <span className="stat-sub">In inventory</span>
        </div>
        {admin && (
          <>
            <div className="stat-card stat-blue">
              <span className="stat-label">Cities</span>
              <strong className="stat-value">{cities.length}</strong>
              <span className="stat-sub">Registered cities</span>
            </div>
            <div className="stat-card stat-orange">
              <span className="stat-label">HUBs</span>
              <strong className="stat-value">{hubs.length}</strong>
              <span className="stat-sub">Active hubs</span>
            </div>
          </>
        )}
        <div className={`stat-card stat-red ${lowStockItems.length > 0 ? 'stat-card-hoverable' : ''}`}>
          <span className="stat-label">Low Stock</span>
          <strong className="stat-value">{lowStockItems.length}</strong>
          <span className="stat-sub">Qty ≤ 10 items</span>
          {lowStockItems.length > 0 && (
            <div className="low-stock-tooltip" role="tooltip">
              <p className="low-stock-tooltip-title">Low stock items</p>
              <ul className="low-stock-tooltip-list">
                {lowStockItems.map((item) => (
                  <li key={item.id}>
                    <span className="low-stock-name">
                      {item.item_description || item.item_code}
                      <small>{item.item_code}{item.hub_name ? ` · ${item.hub_name}` : ''}</small>
                    </span>
                    <span className="low-stock-qty">Qty: {item.qty}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {hubUser && (
          <div className="stat-card stat-orange">
            <span className="stat-label">Pending</span>
            <strong className="stat-value">
              {myRequests.filter((r) => r.status === 'pending').length}
            </strong>
            <span className="stat-sub">Awaiting admin approval</span>
          </div>
        )}
      </div>

      <section className="card dash-card">
        <div className="form-tabs">
          <button
            type="button"
            className={`form-tab ${mode === 'manual' ? 'active' : ''}`}
            onClick={() => setMode('manual')}
          >
            Manual Entry
          </button>
          <button
            type="button"
            className={`form-tab ${mode === 'upload' ? 'active' : ''}`}
            onClick={() => setMode('upload')}
          >
            Upload Excel / CSV
          </button>
        </div>

        {hubUser && (
          <div className="alert alert-info">
            Stock entries are sent for <strong>Admin approval</strong>. Inventory updates only after Admin approves.
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {mode === 'manual' ? (
          <form className="stock-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <label>
                <span>Item Code</span>
                <input name="item_code" value={form.item_code} onChange={handleChange} placeholder="SP001" required />
              </label>
              <label>
                <span>Item Description</span>
                <input name="item_description" value={form.item_description} onChange={handleChange} placeholder="Brake Pad Set" required />
              </label>
              <label>
                <span>Qty</span>
                <input name="qty" type="number" min="0" value={form.qty} onChange={handleChange} placeholder="50" required />
              </label>
              {admin && (
                <>
                  <label>
                    <span>City</span>
                    <div className="select-with-btn">
                      <select name="city_id" value={form.city_id} onChange={handleChange} required>
                        <option value="">— Select City —</option>
                        {cities.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <button type="button" className="btn-add-sm" onClick={() => setAddModal('city')}>+ Add City</button>
                    </div>
                  </label>
                  <label className="span-2">
                    <span>HUB Name</span>
                    <div className="select-with-btn">
                      <select name="hub_id" value={form.hub_id} onChange={handleChange} required disabled={!form.city_id}>
                        <option value="">— Select HUB —</option>
                        {hubsForCity.map((h) => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-add-sm"
                        onClick={() => setAddModal('hub')}
                        disabled={!form.city_id && cities.length === 0}
                      >
                        + Add HUB
                      </button>
                    </div>
                  </label>
                </>
              )}
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving
                ? 'Saving…'
                : hubUser
                  ? 'Submit for Approval'
                  : 'Save Stock'}
            </button>
          </form>
        ) : (
          <div className="upload-zone">
            <div className="upload-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => downloadExcelTemplate({ forHub: hubUser })}
              >
                Download Excel Template
              </button>
              {admin && (
                <a className="btn-secondary" href="/spare-parts-upload-template.xlsx" download>
                  Direct .xlsx link
                </a>
              )}
            </div>

            {hubUser && (
              <div className="invoice-attach">
                <label className="invoice-label">
                  <span>Invoice / Document copy (required)</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                  />
                </label>
                {invoiceFile && (
                  <p className="muted">Attached: {invoiceFile.name}</p>
                )}
              </div>
            )}

            <input
              type="file"
              id="csvUpload"
              accept=".csv,.xlsx,.xls"
              onChange={handleUpload}
              disabled={uploading}
            />
            <label htmlFor="csvUpload">{uploading ? 'Uploading…' : 'Choose Excel or CSV file to upload'}</label>
            {hubUser ? (
              <>
                <p>Columns: <strong>Item Code, Item Description, Qty</strong> only</p>
                <p>City and HUB are taken from your login automatically.</p>
                <p>Attach invoice first, then upload stock file. Admin must approve before stock loads.</p>
              </>
            ) : (
              <p>Columns: Item Code, Item Description, Qty, City, HUB Name</p>
            )}
            {admin && (
              <div className="form-grid" style={{ marginTop: '1rem', textAlign: 'left' }}>
                <label>
                  <span>Default City (optional)</span>
                  <div className="select-with-btn">
                    <select name="city_id" value={form.city_id} onChange={handleChange}>
                      <option value="">— From CSV —</option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button type="button" className="btn-add-sm" onClick={() => setAddModal('city')}>+ Add City</button>
                  </div>
                </label>
                <label>
                  <span>Default HUB (optional)</span>
                  <div className="select-with-btn">
                    <select name="hub_id" value={form.hub_id} onChange={handleChange} disabled={!form.city_id}>
                      <option value="">— From CSV —</option>
                      {hubsForCity.map((h) => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                    <button type="button" className="btn-add-sm" onClick={() => setAddModal('hub')}>+ Add HUB</button>
                  </div>
                </label>
              </div>
            )}
          </div>
        )}
      </section>

      {hubUser && myRequests.length > 0 && (
        <section className="card dash-card">
          <div className="card-toolbar">
            <h3>My Stock Requests</h3>
            <button type="button" className="btn-secondary" onClick={fetchMyRequests}>Refresh</button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Items</th>
                  <th>Invoice</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td>{r.request_type}</td>
                    <td>{r.stock_request_items?.length || 0}</td>
                    <td>{r.invoice_name || '—'}</td>
                    <td>
                      <span className={`status-badge status-${r.status}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card dash-card">
        <div className="card-toolbar">
          <h3>Inventory List</h3>
          <div className="toolbar-filters">
            <input
              type="search"
              placeholder="Search code or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            {admin && (
              <select value={filterHub} onChange={(e) => setFilterHub(e.target.value)}>
                <option value="">All HUBs</option>
                {allHubNames.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="btn-export"
              onClick={() => exportInventoryExcel(filtered)}
              disabled={filtered.length === 0}
            >
              Export Excel
            </button>
            <button
              type="button"
              className="btn-export-outline"
              onClick={() => exportInventoryCsv(filtered)}
              disabled={filtered.length === 0}
            >
              Export CSV
            </button>
            <button type="button" className="btn-secondary" onClick={loadAll}>Refresh</button>
          </div>
        </div>

        {loading ? (
          <p className="muted">Loading inventory…</p>
        ) : filtered.length === 0 ? (
          <p className="muted">No items found.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>City</th>
                  <th>HUB Name</th>
                  {admin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td><code>{item.item_code}</code></td>
                    <td>{item.item_description}</td>
                    <td>
                      <span className={`qty-badge ${item.qty <= 10 ? 'low' : ''}`}>{item.qty}</span>
                    </td>
                    <td>{item.city}</td>
                    <td>{item.hub_name}</td>
                    {admin && (
                      <td>
                        <button type="button" className="btn-danger-sm" onClick={() => setDeleteItem(item)}>
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {admin && deleteItem && (
        <DeleteConfirmModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {admin && addModal && (
        <AddCityHubModal
          type={addModal}
          cities={cities}
          selectedCityId={form.city_id}
          onClose={() => setAddModal(null)}
          onSaveCity={handleSaveCity}
          onSaveHub={handleSaveHub}
        />
      )}
    </div>
  )
}
