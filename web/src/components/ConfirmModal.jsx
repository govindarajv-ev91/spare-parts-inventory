import { useState } from 'react'
import './Modal.css'

export default function ConfirmModal({
  title,
  message,
  details,
  confirmLabel = 'Yes, Confirm',
  cancelLabel = 'Cancel',
  confirmClass = 'btn-primary',
  onClose,
  onConfirm,
}) {
  const [busy, setBusy] = useState(false)

  const handleConfirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p className="modal-text">{message}</p>
        {details && <div className="modal-item-box">{details}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className={confirmClass} onClick={handleConfirm} disabled={busy}>
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
