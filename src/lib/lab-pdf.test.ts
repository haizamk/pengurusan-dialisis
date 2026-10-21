import assert from "node:assert/strict"
import test from "node:test"
import { PDFDocument, StandardFonts } from "pdf-lib"
import { importLabDocument, memoryArchiveStore } from "./lab-archive"
import { parseLabText } from "./lab-parse"
import { textFromPdfBytes } from "./pdf-text"

test("pdf sah disimpan dan nilai yang tercetak diekstrak", async () => {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  page.drawText("Tarikh: 2026-03-12", { x: 50, y: 720, size: 12, font })
  page.drawText("Hemoglobin 10.4 g/dL", { x: 50, y: 690, size: 12, font })
  const bytes = new Uint8Array(await pdf.save())
  const text = await textFromPdfBytes(bytes)
  const parsed = parseLabText(text)
  assert.equal(parsed.reportDate, "2026-03-12")
  assert.equal(parsed.observations.find((item) => item.standardKey === "hemoglobin")?.value, 10.4)
  assert.equal(parsed.observations.find((item) => item.standardKey === "hemoglobin")?.unit, "g/dl")

  const store = memoryArchiveStore()
  const saved = await importLabDocument(store, {
    patientId: "pesakit-ujian",
    fileName: "laporan.pdf",
    mime: "application/pdf",
    bytes,
    text,
    note: "Teks dibaca.",
    extractionStatus: "terbaca",
    allowDuplicate: false,
    uploadedAt: "2026-03-12T00:00:00.000Z",
  })
  const file = await store.getFile(saved.document!.id)
  assert.equal(file?.bytes.length, bytes.length)
  assert.equal(file?.bytes[0], 0x25)
  assert.equal(saved.observations[0]?.status, "perlu_semakan")
  assert.equal(saved.document?.patientId, "pesakit-ujian")
})
