import * as XLSX from 'xlsx'

function findColumnIndex(header, matchers) {
  return header.findIndex((h) => matchers.some((m) => h.includes(m)))
}

function mapRow(cols, idx, rowNum) {
  return {
    row: rowNum,
    item_code: String(cols[idx.code] ?? '').trim(),
    item_description: String(cols[idx.desc] ?? '').trim(),
    oem_name: idx.oem >= 0 ? String(cols[idx.oem] ?? '').trim() : '',
    qty: parseInt(String(cols[idx.qty] ?? ''), 10),
    city: idx.city >= 0 ? String(cols[idx.city] ?? '').trim() : '',
    hub_name: idx.hub >= 0 ? String(cols[idx.hub] ?? '').trim() : '',
  }
}

function parseHeaderRow(headerRow) {
  const header = headerRow.map((h) => String(h ?? '').toLowerCase().trim())
  const idx = {
    code: findColumnIndex(header, ['item code', 'itemcode', 'code']),
    desc: findColumnIndex(header, ['item description', 'description']),
    oem: findColumnIndex(header, ['oem', 'oem name', 'vehicle brand', 'brand']),
    qty: findColumnIndex(header, ['qty', 'quantity']),
    city: findColumnIndex(header, ['city']),
    hub: findColumnIndex(header, ['hub']),
  }

  if (idx.code === -1 || idx.desc === -1 || idx.qty === -1) {
    throw new Error('File must have columns: Item Code, Item Description, Qty')
  }

  return idx
}

export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const header = lines[0].split(',').map((h) => h.trim())
  const idx = parseHeaderRow(header)

  return lines.slice(1).filter((l) => l.trim()).map((line, i) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    return mapRow(cols, idx, i + 2)
  })
}

export function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  if (rows.length < 2) return []

  let headerRowIndex = rows.findIndex((row) => {
    const line = row.map((c) => String(c).toLowerCase())
    return line.some((c) => c.includes('item') && c.includes('code'))
  })

  if (headerRowIndex === -1) headerRowIndex = 0

  const idx = parseHeaderRow(rows[headerRowIndex])
  const dataRows = rows.slice(headerRowIndex + 1).filter((row) =>
    row.some((cell) => String(cell).trim() !== '')
  )

  return dataRows.map((cols, i) =>
    mapRow(cols, idx, headerRowIndex + i + 2)
  )
}

/** Hub users: Item Code, Description, OEM, Qty. Admin: includes City + HUB Name. */
export function downloadExcelTemplate({ forHub = false } = {}) {
  if (forHub) {
    const headers = ['Item Code', 'Item Description', 'OEM Name', 'Qty']
    const sampleRows = [
      ['SP001', 'Brake Pad Set', 'MOTOVOLT', 50],
      ['SP002', 'Oil Filter', 'ATHER', 120],
      ['SP003', 'Spark Plug', 'OLA', 200],
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows])
    ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 8 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Upload')
    XLSX.writeFile(wb, 'spare-parts-hub-upload-template.xlsx')
    return
  }

  const headers = ['Item Code', 'Item Description', 'OEM Name', 'Qty', 'City', 'HUB Name']
  const sampleRows = [
    ['SP001', 'Brake Pad Set', 'MOTOVOLT', 50, 'Colombo', 'Hub A'],
    ['SP002', 'Oil Filter', 'ATHER', 120, 'Colombo', 'Hub B'],
    ['SP003', 'Spark Plug', 'OLA', 200, 'Kandy', 'Hub A'],
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows])
  ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 8 }, { wch: 14 }, { wch: 14 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Stock Upload')
  XLSX.writeFile(wb, 'spare-parts-upload-template.xlsx')
}
