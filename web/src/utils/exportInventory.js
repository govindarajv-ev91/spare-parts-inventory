import * as XLSX from 'xlsx'

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportInventoryCsv(items) {
  const headers = ['Item Code', 'Description', 'OEM Name', 'Qty', 'City', 'HUB Name']
  const rows = items.map((i) => [
    i.item_code,
    i.item_description,
    i.oem_name || '',
    i.qty,
    i.city || '',
    i.hub_name || '',
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const stamp = new Date().toISOString().slice(0, 10)
  downloadBlob(csv, `inventory-list-${stamp}.csv`, 'text/csv;charset=utf-8;')
}

export function exportInventoryExcel(items) {
  const rows = items.map((i) => ({
    'Item Code': i.item_code,
    Description: i.item_description,
    'OEM Name': i.oem_name || '',
    Qty: i.qty,
    City: i.city || '',
    'HUB Name': i.hub_name || '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 14 },
    { wch: 28 },
    { wch: 16 },
    { wch: 8 },
    { wch: 14 },
    { wch: 14 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory List')
  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `inventory-list-${stamp}.xlsx`)
}
