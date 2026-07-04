import { useState } from 'react'
import './Modal.css'

export default function AddCityHubModal({ type, cities, selectedCityId, onClose, onSaveCity, onSaveHub }) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [cityId, setCityId] = useState(selectedCityId || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isCity = type === 'city'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!isCity && !cityId) {
      setError('Please select a city')
      return
    }
    if (!isCity && !password.trim()) {
      setError('HUB login password is required')
      return
    }

    setSaving(true)
    const err = isCity
      ? await onSaveCity(name.trim())
      : await onSaveHub(cityId, name.trim(), password.trim())
    setSaving(false)

    if (err) setError(err)
    else onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-sm" onClick={(e) => e.stopPropagation()}>
        <h3>{isCity ? 'Add New City' : 'Add New HUB'}</h3>
        <p className="modal-subtext">
          {isCity
            ? 'One city can have multiple HUBs (e.g. Hub A, Hub B, Hub C).'
            : 'Add a HUB under the selected city. Password is used for HUB web login.'}
        </p>

        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}

          {!isCity && (
            <label className="modal-field">
              <span>City</span>
              <select value={cityId} onChange={(e) => setCityId(e.target.value)} required>
                <option value="">— Select City —</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}

          <label className="modal-field">
            <span>{isCity ? 'City Name' : 'HUB Name (login username)'}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isCity ? 'Colombo' : 'Hub A'}
              autoFocus
              required
            />
          </label>

          {!isCity && (
            <label className="modal-field">
              <span>HUB Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Login password for this HUB"
                required
              />
            </label>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
