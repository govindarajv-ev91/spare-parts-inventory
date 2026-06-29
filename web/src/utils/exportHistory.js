import * as XLSX from 'xlsx'

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function exportHistoryCsv(records) {
  const headers = [
    'Date & Time',
    'Item Code',
    'Description',
    'HUB',
    'City',
    'Qty Used',
    'Qty Before',
    'Qty After',
    'Vehicle Number',
  ]

  const rows = records.map((r) => [
    formatDate(r.created_at),
    r.item_code,
    r.item_description,
    r.hub_name,
    r.city || '',
    r.qty_used,
    r.qty_before,
    r.qty_after,
    r.vehicle_number,
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  downloadBlob(csv, 'usage-history.csv', 'text/csv;charset=utf-8;')
}

export function exportHistoryExcel(records) {
  const rows = records.map((r) => ({
    'Date & Time': formatDate(r.created_at),
    'Item Code': r.item_code,
    Description: r.item_description,
    HUB: r.hub_name,
    City: r.city || '',
    'Qty Used': r.qty_used,
    'Qty Before': r.qty_before,
    'Qty After': r.qty_after,
    'Vehicle Number': r.vehicle_number,
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 22 }, { wch: 14 }, { wch: 28 }, { wch: 12 },
    { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 18 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Usage History')
  XLSX.writeFile(wb, 'usage-history.xlsx')
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
