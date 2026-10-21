import assert from "node:assert/strict"
import test from "node:test"
import { PDFDocument, StandardFonts } from "pdf-lib"
import { draftFromText } from "./lab-archive"
import { observationsFromGemini, selectedGeminiModel, validateGeminiPayload } from "./lab-gemini"
import { extractWithGemini } from "./lab-gemini-server"
import { extractReport, PATIENT_STATUS } from "./pdf-text"

test("model Gemini lama kekal untuk parser kompatibiliti", () => {
  assert.equal(selectedGeminiModel("gemini-3.8-flash"), "gemini-3.8-flash")
  assert.equal(selectedGeminiModel("gemini-nama-cipta"), "gemini-3.8-flash")
  assert.equal(selectedGeminiModel(""), "gemini-3.8-flash")
})

test("nilai yang tidak ada dalam teks laporan ditolak", () => {
  const validated = validateGeminiPayload({
    sampleDate: "2026-03-12",
    dateUncertain: false,
    results: [
      { name: "Hemoglobin", valueText: "11.2", unit: "g/dL", referenceRange: null, abnormalFlag: null, visibleText: "Hemoglobin 11.2 g/dL", uncertain: false, page: 1 },
      { name: "Kalium", valueText: "4.5", unit: "mmol/L", referenceRange: null, abnormalFlag: null, visibleText: "Tiada kalium pada baris ini", uncertain: false, page: 1 },
    ],
  })
  const mapped = observationsFromGemini(validated.payload!)
  assert.equal(mapped.rejected, 1)
  assert.equal(mapped.report.observations.length, 1)
  assert.equal(mapped.report.observations[0]?.value, 11.2)
  assert.equal(mapped.report.observations[0]?.unit, "g/dl")
  assert.equal(mapped.report.observations[0]?.standardKey, "hemoglobin")
})

test("ketidaksamaan tidak disimpan sebagai nombor", () => {
  const mapped = observationsFromGemini({
    sampleDate: "2026-03-12",
    dateUncertain: false,
    results: [{ name: "Potassium", valueText: "<5.5", unit: "mmol/L", referenceRange: null, abnormalFlag: null, visibleText: "Potassium <5.5 mmol/L", uncertain: false, page: 1 }],
  })
  assert.equal(mapped.report.observations[0]?.value, null)
  assert.equal(mapped.report.observations[0]?.uncertain, true)
  assert.match(mapped.report.observations[0]?.snippet ?? "", /<5\.5/)
})

test("draf kekal perlu semakan dan tidak disahkan", () => {
  const mapped = observationsFromGemini({
    sampleDate: "2026-03-12",
    dateUncertain: false,
    results: [{ name: "Hemoglobin", valueText: "11.2", unit: "g/dL", referenceRange: "10.0 - 12.0", abnormalFlag: null, visibleText: "Hemoglobin 11.2 g/dL 10.0 - 12.0", uncertain: false, page: 1 }],
  })
  const draft = draftFromText({
    id: "dokumen-nous-openai",
    patientId: "pesakit-a",
    fileName: "imbasan.pdf",
    mime: "application/pdf",
    byteSize: 20,
    sha256: "abc",
    text: "Hemoglobin 11.2 g/dL",
    uploadedAt: "2026-03-12T00:00:00.000Z",
    note: PATIENT_STATUS.found,
    extractionStatus: "separa",
    observations: mapped.report.observations,
    reportDate: mapped.report.reportDate,
    dateUncertain: mapped.report.dateUncertain,
  })
  assert.equal(draft.observations[0]?.status, "perlu_semakan")
  assert.equal(draft.observations[0]?.value, 11.2)
  assert.equal(draft.document.processingStatus, "selesai")
})

test("pelayan menolak fail rosak dan kunci Nous yang tiada", async () => {
  const missing = await extractWithGemini(new Uint8Array([0x25, 0x50, 0x44, 0x46, 1]), { name: "a.pdf", type: "application/pdf" })
  assert.equal(missing.ok, false)
  if (!missing.ok) assert.equal(missing.errorCode, "tiada-enjin")
  const broken = await extractWithGemini(new Uint8Array([1, 2, 3]), { name: "salah.pdf", type: "application/pdf" })
  assert.equal(broken.ok, false)
  if (!broken.ok) assert.equal(broken.errorCode, "fail-tidak-sah")
})

test("ekstraksi hanya memerlukan NOUS_API_KEY", async () => {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  page.drawText("Hemoglobin 11.2 g/dL", { x: 50, y: 690, size: 12, font })
  const bytes = new Uint8Array(await pdf.save())
  const oldNous = process.env.NOUS_API_KEY
  delete process.env.NOUS_API_KEY
  try {
    const result = await extractWithGemini(bytes, { name: "imbasan.pdf", type: "application/pdf" })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.errorCode, "tiada-enjin")
      assert.match(result.errorMessage, /NOUS_API_KEY/)
    }
  } finally {
    if (oldNous === undefined) delete process.env.NOUS_API_KEY
    else process.env.NOUS_API_KEY = oldNous
  }
})
