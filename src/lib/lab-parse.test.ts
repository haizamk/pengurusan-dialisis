import assert from "node:assert/strict"
import test from "node:test"
import { buildLabAnalysis, filterByRange, parameterSeries, sharedPrintedRange, type ConfirmedResult } from "./lab-analysis"
import { parseLabText, validateLabFile } from "./lab-parse"

const report = `
Tarikh: 12/03/2026
Hemoglobin 10.4 g/dL 10.0 - 12.0
Potassium 6.8 mmol/L H
Phosphate 1.92 mmol/L
Albumin
Creatinine 640
Calcium 2.31 mmol/L (2.10-2.54)
`

test("ekstrak hanya baris yang nama, nilai dan unitnya jelas", () => {
  const parsed = parseLabText(report)
  assert.equal(parsed.reportDate, "2026-03-12")
  const hb = parsed.observations.find((item) => item.standardKey === "hemoglobin")
  assert.equal(hb?.value, 10.4)
  assert.equal(hb?.unit, "g/dl")
  assert.match(hb?.refText ?? "", /10.0/)
  const potassium = parsed.observations.find((item) => item.originalName === "Kalium")
  assert.equal(potassium?.value, 6.8)
  assert.equal(potassium?.uncertain, false)
  assert.equal(potassium?.abnormalFlag, "H")
  assert.equal(parsed.observations.find((item) => item.standardKey === "hemoglobin")?.abnormalFlag, null)
})

test("nilai atau unit yang tidak lengkap ditanda tidak pasti dan tidak diteka", () => {
  const parsed = parseLabText(report)
  const albumin = parsed.observations.find((item) => item.originalName === "Albumin")
  const creatinine = parsed.observations.find((item) => item.originalName === "Kreatinin")
  assert.equal(albumin?.uncertain, true)
  assert.equal(albumin?.value, null)
  assert.equal(creatinine?.value, null)
  assert.equal(creatinine?.uncertain, true)
})

test("fail ditolak jika sambungan tidak sepadan dengan kandungan", () => {
  const error = validateLabFile(
    { name: "laporan.pdf", type: "application/pdf", size: 4 },
    new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  )
  assert.match(error ?? "", /PDF, JPG atau PNG/)
  assert.equal(validateLabFile({ name: "a.pdf", type: "application/pdf", size: 4 }, new Uint8Array([0x25, 0x50, 0x44, 0x46])), null)
})

test("siri carta tidak mengisi nilai kosong sebagai sifar dan tidak mencampur unit", () => {
  const results: ConfirmedResult[] = [
    { standardKey: "hemoglobin", label: "Hemoglobin", takenOn: "2026-01-01", value: 9.5, unit: "g/dl", refText: null, source: "disahkan" },
    { standardKey: "hemoglobin", label: "Hemoglobin", takenOn: "2026-04-01", value: 10.2, unit: "g/dl", refText: null, source: "disahkan" },
    { standardKey: "hemoglobin", label: "Hemoglobin", takenOn: "2026-04-02", value: 102, unit: "g/l", refText: null, source: "disahkan" },
  ]
  const series = parameterSeries(results)
  assert.equal(series.length, 2)
  const gdl = series.find((item) => item.unit === "g/dl")
  assert.deepEqual(gdl?.points.map((point) => point.value), [9.5, 10.2])
  assert.equal(gdl?.points.some((point) => point.value === 0), false)
})

test("analisis hanya memetik rekod yang diberi dan tidak menetapkan ubat", () => {
  const report = buildLabAnalysis([
    { standardKey: "potassium", label: "Kalium", takenOn: "2026-03-12", value: 6.8, unit: "mmol/l", refText: "3.5 - 5.5", source: "disahkan" },
    { standardKey: "phosphate", label: "Fosfat", takenOn: "2026-03-12", value: 1.92, unit: "mmol/l", refText: null, source: "disahkan" },
    { standardKey: "albumin", label: "Albumin", takenOn: "2026-03-12", value: 32, unit: "g/l", refText: null, source: "manual" },
  ], "2026-03-13T00:00:00.000Z")
  const text = JSON.stringify(report)
  assert.match(text, /6\.8/)
  assert.match(text, /2026-03-12/)
  assert.match(text, /Hubungi pasukan dialisis/)
  assert.doesNotMatch(text, /ambil \d+ mg|hentikan pengikat|ubah dialisis/i)
  assert.match(report.diet.map((item) => item.limit).join(" "), /Jangan mulakan|suplemen|pengikat fosfat/)
  assert.equal(report.parameters.find((item) => item.key === "potassium")?.previous, null)
})

test("teks yang melekat masih dibaca tanpa meneka unit yang tiada", () => {
  const parsed = parseLabText("Hemoglobin10.4g/dL\nCreatinine640")
  assert.equal(parsed.observations.find((item) => item.standardKey === "hemoglobin")?.value, 10.4)
  assert.equal(parsed.observations.find((item) => item.originalName === "Kreatinin")?.value, null)
})

test("julat bercampur tidak dijadikan satu jalur", () => {
  assert.equal(sharedPrintedRange([{ refText: "10.0 - 12.0" }, { refText: "11 - 13" }]), null)
  assert.deepEqual(sharedPrintedRange([{ refText: "10.0 - 12.0" }, { refText: "10.0-12.0" }]), { low: 10, high: 12 })
})

test("penapis tarikh tidak mencipta titik palsu", () => {
  const points = [{ takenOn: "2025-01-01" }, { takenOn: "2026-03-01" }]
  const filtered = filterByRange(points, "3m", "2026-04-01")
  assert.deepEqual(filtered, [{ takenOn: "2026-03-01" }])
})
