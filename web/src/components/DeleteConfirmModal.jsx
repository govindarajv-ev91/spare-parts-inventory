import { useState } from 'react'
import './Modal.css'

export default function DeleteConfirmModal({ item, onClose, onConfirm }) {
  const [step, setStep] = useState(1)
  const [deleting, setDeleting] = useState(false)

  if (!item) return null

  const itemLabel = `${item.item_description} (${item.item_code})`

  const handleFinalDelete = async () => {
    setDeleting(true)
    await onConfirm(item.id)
    setDeleting(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-steps">
          <span className={step >= 1 ? 'active' : ''}>1</span>
          <span className="line" />
          <span className={step >= 2 ? 'active' : ''}>2</span>
          <span className="line" />
          <span className={step >= 3 ? 'active' : ''}>3</span>
        </div>

        {step === 1 && (
          <>
            <h3>Step 1 of 3 — Delete Warning</h3>
            <p className="modal-text">
              Are you sure you want to delete this item from inventory?
            </p>
            <div className="modal-item-box">
              <strong>{item.item_description}</strong>
              <span>Item Code: {item.item_code}</span>
              <span>HUB: {item.hub_name} · {item.city}</span>
              <span>Qty: {item.qty}</span>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="btn-warning" onClick={() => setStep(2)}>Continue</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3>Step 2 of 3 — Confirm Item</h3>
            <p className="modal-text">
              Please confirm: Do you want to delete <strong>{item.item_description}</strong>?
            </p>
            <p className="modal-subtext">
              Item Code: <code>{item.item_code}</code> at HUB <strong>{item.hub_name}</strong>
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setStep(1)}>Go Back</button>
              <button type="button" className="btn-warning" onClick={() => setStep(3)}>Yes, Continue</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3>Step 3 of 3 — Final Confirmation</h3>
            <p className="modal-text modal-danger-text">
              This action <strong>cannot be undone</strong>.
            </p>
            <p className="modal-text">
              Are you sure you want to permanently delete <strong>{itemLabel}</strong>?
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setStep(2)} disabled={deleting}>Go Back</button>
              <button type="button" className="btn-danger" onClick={handleFinalDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
