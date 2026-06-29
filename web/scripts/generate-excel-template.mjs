import * as XLSX from 'xlsx'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public')
mkdirSync(outDir, { recursive: true })

const headers = ['Item Code', 'Item Description', 'Qty', 'City', 'HUB Name']
const sampleRows = [
  ['SP001', 'Brake Pad Set', 50, 'Colombo', 'Hub A'],
  ['SP002', 'Oil Filter', 120, 'Colombo', 'Hub B'],
  ['SP003', 'Spark Plug', 200, 'Kandy', 'Hub A'],
]

const instructions = [
  ['SPARE PARTS INVENTORY - UPLOAD TEMPLATE'],
  [''],
  ['Instructions:'],
  ['1. Fill rows below starting from row 6 (do not change header row 5).'],
  ['2. One city can have multiple HUBs (e.g. Colombo → Hub A, Hub B, Hub C).'],
  ['3. Add cities and HUBs on the web page first, or type exact names here.'],
  ['4. Save as .xlsx or .csv and upload on the web Upload tab.'],
  [''],
  ...headers.map(() => ['']),
]

const sheetData = [
  ...instructions.slice(0, 8),
  headers,
  ...sampleRows,
]

const ws = XLSX.utils.aoa_to_sheet(sheetData)

ws['!cols'] = [
  { wch: 14 },
  { wch: 28 },
  { wch: 8 },
  { wch: 14 },
  { wch: 14 },
]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Stock Upload')

const outPath = join(outDir, 'spare-parts-upload-template.xlsx')
XLSX.writeFile(wb, outPath)
console.log('Created:', outPath)
