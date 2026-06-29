import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import AddCityHubModal from '../components/AddCityHubModal'
import { parseCsv, parseExcel, downloadExcelTemplate } from '../utils/uploadParser'
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
  const [items, setItems] = useState([])
  const [cities, setCities] = useState([])
  const [hubs, setHubs] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [mode, setMode] = useState('manual')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filterHub, setFilterHub] = useState('')
  const [search, setSearch] = useState('')
  const [deleteItem, setDeleteItem] = useState(null)
  const [addModal, setAddModal] = useState(null)

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
    const { data, error: err } = await supabase
      .from('inventory')
      .select('*')
      .order('hub_name')
      .order('item_code')

    if (err) {
      setError(err.message)
      setItems([])
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  const loadAll = async () => {
    await Promise.all([fetchCities(), fetchHubs(), fetchItems()])
  }

  useEffect(() => {
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

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'city_id') {
      setForm((f) => ({ ...f, city_id: value, hub_id: '' }))
    } else {
      setForm((f) => ({ ...f, [name]: value }))
    }
  }

  const saveStockRow = async (itemCode, itemDesc, qty, cityName, hubName) => {
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const qty = parseInt(form.qty, 10)
    if (!form.item_code.trim() || !form.item_description.trim() || !form.city_id || !form.hub_id) {
      setError('All fields are required')
      return
    }
    if (isNaN(qty) || qty < 0) {
      setError('Qty must be a valid number (0 or more)')
      return
    }

    setSaving(true)
    const { error: err } = await saveStockRow(
      form.item_code.trim(),
      form.item_description.trim(),
      qty,
      selectedCity.name,
      selectedHub.name
    )
    setSaving(false)

    if (err) {
      setError(err.message)
    } else {
      setSuccess('Stock saved successfully')
      setForm(emptyForm)
      fetchItems()
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setSuccess('')
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

      let ok = 0
      let fail = 0
      for (const row of rows) {
        if (!row.item_code || !row.item_description || isNaN(row.qty) || row.qty < 0) {
          fail++
          continue
        }
        let cityName = row.city
        let hubName = row.hub_name

        if (!cityName || !hubName) {
          if (selectedCity && selectedHub) {
            cityName = selectedCity.name
            hubName = selectedHub.name
          } else {
            fail++
            continue
          }
        }

        const { error: err } = await saveStockRow(
          row.item_code,
          row.item_description,
          row.qty,
          cityName,
          hubName
        )
        if (err) fail++
        else ok++
      }

      setSuccess(`Upload complete: ${ok} saved, ${fail} skipped`)
      fetchItems()
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

  const handleSaveHub = async (cityId, name) => {
    const { error: err } = await supabase.from('hubs').insert({ city_id: cityId, name })
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
        <div className="stat-card stat-red">
          <span className="stat-label">Low Stock</span>
          <strong className="stat-value">{items.filter((i) => i.qty <= 10).length}</strong>
          <span className="stat-sub">Qty ≤ 10 items</span>
        </div>
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
                {form.city_id && hubsForCity.length > 0 && (
                  <div className="hub-list-preview">
                    {hubsForCity.map((h) => (
                      <span key={h.id} className="hub-tag">{h.name}</span>
                    ))}
                  </div>
                )}
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
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Stock'}
            </button>
          </form>
        ) : (
          <div className="upload-zone">
            <div className="upload-actions">
              <button type="button" className="btn-primary" onClick={downloadExcelTemplate}>
                Download Excel Template
              </button>
              <a className="btn-secondary" href="/spare-parts-upload-template.xlsx" download>
                Direct .xlsx link
              </a>
            </div>
            <input
              type="file"
              id="csvUpload"
              accept=".csv,.xlsx,.xls"
              onChange={handleUpload}
              disabled={uploading}
            />
            <label htmlFor="csvUpload">{uploading ? 'Uploading…' : 'Choose Excel or CSV file to upload'}</label>
            <p>Columns: Item Code, Item Description, Qty, City, HUB Name</p>
            <p>Use the template above — fill in your data and upload the .xlsx file</p>
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
          </div>
        )}
      </section>

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
            <select value={filterHub} onChange={(e) => setFilterHub(e.target.value)}>
              <option value="">All HUBs</option>
              {allHubNames.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <button type="button" className="btn-secondary" onClick={loadAll}>Refresh</button>
          </div>
        </div>

        {loading ? (
          <p className="muted">Loading inventory…</p>
        ) : filtered.length === 0 ? (
          <p className="muted">No items found. Add cities & HUBs first, then add stock.</p>
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
                  <th></th>
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
                    <td>
                      <button type="button" className="btn-danger-sm" onClick={() => setDeleteItem(item)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {deleteItem && (
        <DeleteConfirmModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {addModal && (
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
