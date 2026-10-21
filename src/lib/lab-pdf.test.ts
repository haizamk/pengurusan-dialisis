import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { createCanvas, GlobalFonts } from "@napi-rs/canvas"
import { PDFDocument, StandardFonts } from "pdf-lib"
import { extractText, getDocumentProxy } from "unpdf"
import { draftFromText, importLabDocument, memoryArchiveStore } from "./lab-archive"
import { parseLabText } from "./lab-parse"
import { extractReport, PATIENT_STATUS, textFromPdfBytes } from "./pdf-text"

GlobalFonts.registerFromPath("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "DejaVu")

function drawReport(lines: string[]) {
  const canvas = createCanvas(1200, 160 + lines.length * 80)
  const context = canvas.getContext("2d")
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = "#000000"
  context.font = "54px DejaVu"
  lines.forEach((line, index) => context.fillText(line, 48, 100 + index * 80))
  return canvas
}

async function imageOnlyPdf(png: Uint8Array) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([1200, 400])
  const image = await pdf.embedPng(png)
  page.drawImage(image, { x: 0, y: 0, width: 1200, height: 400 })
  return new Uint8Array(await pdf.save())
}

describe("bacaan laporan", { concurrency: false, timeout: 180_000 }, () => {
  test("pdf sah disimpan dan nilai yang tercetak diekstrak", async () => {
    const pdf = await PDFDocument.create()
    const page = pdf.addPage()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    page.drawText("Tarikh: 2026-03-12", { x: 50, y: 720, size: 12, font })
    page.drawText("Hemoglobin 10.4 g/dL", { x: 50, y: 690, size: 12, font })
    const bytes = new Uint8Array(await pdf.save())
    const outcome = await extractReport(bytes, { name: "laporan.pdf", type: "application/pdf" })
    assert.equal(outcome.diagnostic.method, "pdf-teks")
    assert.equal(outcome.diagnostic.selectableText, true)
    assert.equal(outcome.diagnostic.errorCode, null)
    const text = outcome.text
    const parsed = parseLabText(text)
    assert.equal(parsed.reportDate, "2026-03-12")
    assert.equal(parsed.observations.find((item) => item.standardKey === "hemoglobin")?.value, 10.4)
    assert.equal(parsed.observations.find((item) => item.standardKey === "hemoglobin")?.unit, "g/dl")
    assert.equal(await textFromPdfBytes(bytes), text)

    const store = memoryArchiveStore()
    const saved = await importLabDocument(store, {
      patientId: "pesakit-ujian",
      fileName: "laporan.pdf",
      mime: "application/pdf",
      bytes,
      text,
      note: "Teks dibaca.",
      extractionStatus: "terbaca",
      diagnostic: outcome.diagnostic,
      allowDuplicate: false,
      uploadedAt: "2026-03-12T00:00:00.000Z",
    })
    const file = await store.getFile(saved.document!.id)
    assert.equal(file?.bytes.length, bytes.length)
    assert.equal(file?.bytes[0], 0x25)
    assert.equal(saved.observations[0]?.status, "perlu_semakan")
    assert.equal(saved.document?.patientId, "pesakit-ujian")
    assert.equal(saved.document?.diagnostic?.documentId, saved.document?.id)
    assert.equal(JSON.stringify(saved.document?.diagnostic).includes("10.4"), false)
  })

  test("pdf imej yang dahulunya kosong dibaca dengan OCR tanpa disahkan", async () => {
    const png = new Uint8Array(drawReport(["Tarikh: 12/03/2026", "Hemoglobin 11.2 g/dL"]).toBuffer("image/png"))
    const bytes = await imageOnlyPdf(png)
    const proxy = await getDocumentProxy(new Uint8Array(bytes))
    const legacy = await extractText(proxy, { mergePages: true })
    assert.equal(String(legacy.text ?? "").trim(), "")

    const outcome = await extractReport(bytes, { name: "imbasan.pdf", type: "application/pdf" })
    assert.equal(outcome.diagnostic.method, "ocr")
    assert.equal(outcome.diagnostic.selectableText, false)
    assert.equal(outcome.diagnostic.pageCount, 1)
    assert.equal(outcome.diagnostic.pagesFailed, 0)
    assert.match(outcome.text, /11\.2/)
    const draft = draftFromText({
      id: "dokumen-ocr",
      patientId: "pesakit-ujian",
      fileName: "imbasan.pdf",
      mime: "application/pdf",
      byteSize: bytes.length,
      sha256: "ocr",
      text: outcome.text,
      uploadedAt: "2026-03-12T00:00:00.000Z",
      note: outcome.patientStatus,
      extractionStatus: "separa",
      diagnostic: outcome.diagnostic,
    })
    const hemoglobin = draft.observations.find((item) => item.value === 11.2)
    assert.ok(hemoglobin, outcome.text)
    assert.equal(hemoglobin?.unit, "g/dl")
    assert.equal(hemoglobin?.status, "perlu_semakan")
    assert.equal(JSON.stringify(draft.document.diagnostic).includes("Hemoglobin"), false)
    assert.equal(draft.document.processingStatus, "selesai")
  })

  test("halaman imej dan halaman teks dibaca bersama", async () => {
    const png = new Uint8Array(drawReport(["Hemoglobin 11.2 g/dL"]).toBuffer("image/png"))
    const pdf = await PDFDocument.create()
    const scan = pdf.addPage([1200, 320])
    scan.drawImage(await pdf.embedPng(png), { x: 0, y: 0, width: 1200, height: 320 })
    const page = pdf.addPage()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    page.drawText("Tarikh: 2026-03-12", { x: 50, y: 720, size: 12, font })
    page.drawText("Potassium 4.1 mmol/L", { x: 50, y: 690, size: 12, font })
    const bytes = new Uint8Array(await pdf.save())
    const outcome = await extractReport(bytes, { name: "dua-halaman.pdf", type: "application/pdf" })
    assert.equal(outcome.diagnostic.pageCount, 2)
    assert.equal(outcome.diagnostic.method, "pdf-teks+ocr")
    assert.match(outcome.text, /Halaman 1/)
    assert.match(outcome.text, /Halaman 2/)
    const parsed = parseLabText(outcome.text)
    assert.equal(parsed.observations.find((item) => item.value === 11.2)?.unit, "g/dl")
    assert.equal(parsed.observations.find((item) => item.standardKey === "potassium")?.value, 4.1)
    assert.equal(parsed.observations.find((item) => item.standardKey === "potassium")?.unit, "mmol/l")
    assert.equal(outcome.diagnostic.pagesFailed, 0)
  })

  test("jpg dan png menggunakan OCR yang sama", async () => {
    const drawn = drawReport(["Tarikh: 12/03/2026", "Hemoglobin 11.2 g/dL"])
    const png = new Uint8Array(drawn.toBuffer("image/png"))
    const jpg = new Uint8Array(drawn.toBuffer("image/jpeg"))
    const pngOutcome = await extractReport(png, { name: "laporan.png", type: "image/png" })
    const jpgOutcome = await extractReport(jpg, { name: "laporan.jpg", type: "image/jpeg" })
    for (const outcome of [pngOutcome, jpgOutcome]) {
      assert.equal(outcome.diagnostic.method, "ocr")
      assert.equal(outcome.diagnostic.pageCount, 1)
      const parsed = parseLabText(outcome.text)
      assert.equal(parsed.observations.find((item) => item.value === 11.2)?.unit, "g/dl", outcome.text)
    }
  })

  test("OCR yang dimatikan gagal dengan sebab yang jelas dan fail asal kekal", async () => {
    const previous = process.env.PPD_OCR
    process.env.PPD_OCR = "off"
    try {
      const png = new Uint8Array(drawReport(["Hemoglobin 11.2 g/dL"]).toBuffer("image/png"))
      const bytes = await imageOnlyPdf(png)
      const outcome = await extractReport(bytes, { name: "imbasan.pdf", type: "application/octet-stream" })
      assert.equal(outcome.text, "")
      assert.equal(outcome.patientStatus, PATIENT_STATUS.failed)
      assert.equal(outcome.diagnostic.errorCode, "ocr-tidak-tersedia")
      assert.match(outcome.diagnostic.errorMessage ?? "", /OCR tempatan dimatikan/)
      assert.doesNotMatch(outcome.diagnostic.errorMessage ?? "", /https?:|file:/i)
      const store = memoryArchiveStore()
      const saved = await importLabDocument(store, {
        patientId: "pesakit-ujian",
        fileName: "imbasan.pdf",
        mime: "application/pdf",
        bytes,
        text: outcome.text,
        note: outcome.patientStatus,
        extractionStatus: "gagal",
        diagnostic: outcome.diagnostic,
        allowDuplicate: false,
        uploadedAt: "2026-03-12T00:00:00.000Z",
      })
      assert.equal(saved.observations.length, 0)
      assert.equal(saved.document?.processingStatus, "gagal")
      assert.equal((await store.getFile(saved.document!.id))?.bytes.length, bytes.length)
    } finally {
      if (previous == null) delete process.env.PPD_OCR
      else process.env.PPD_OCR = previous
    }
  })

  test("halaman teks kekal apabila halaman imej tidak boleh dibaca", async () => {
    const previous = process.env.PPD_OCR
    process.env.PPD_OCR = "off"
    try {
      const png = new Uint8Array(drawReport(["Hemoglobin 11.2 g/dL"]).toBuffer("image/png"))
      const pdf = await PDFDocument.create()
      const scan = pdf.addPage([1200, 320])
      scan.drawImage(await pdf.embedPng(png), { x: 0, y: 0, width: 1200, height: 320 })
      const page = pdf.addPage()
      const font = await pdf.embedFont(StandardFonts.Helvetica)
      page.drawText("Tarikh: 2026-03-12", { x: 50, y: 720, size: 12, font })
      page.drawText("Potassium 4.1 mmol/L", { x: 50, y: 690, size: 12, font })
      const bytes = new Uint8Array(await pdf.save())
      const outcome = await extractReport(bytes, { name: "separa.pdf", type: "application/pdf" })
      assert.equal(outcome.diagnostic.pagesFailed > 0, true)
      assert.equal(outcome.diagnostic.errorCode, "ocr-tidak-tersedia")
      assert.equal(outcome.diagnostic.method, "pdf-teks")
      const parsed = parseLabText(outcome.text)
      assert.equal(parsed.observations.find((item) => item.standardKey === "potassium")?.value, 4.1)
      assert.equal(parsed.observations.some((item) => item.value === 11.2), false)
    } finally {
      if (previous == null) delete process.env.PPD_OCR
      else process.env.PPD_OCR = previous
    }
  })

  test("fail rosak atau tidak sepadan tidak menghasilkan nilai", async () => {
    const broken = await extractReport(new Uint8Array(Buffer.from("%PDF-1.4\nbukan pdf")), { name: "rosak.pdf", type: "application/pdf" })
    assert.equal(broken.text, "")
    assert.equal(broken.patientStatus, PATIENT_STATUS.failed)
    assert.ok(broken.diagnostic.errorCode)
    assert.doesNotMatch(broken.diagnostic.errorMessage ?? "", /https?:\/\/|file:/i)
    const mismatch = await extractReport(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { name: "salah.pdf", type: "application/pdf" })
    assert.equal(mismatch.diagnostic.errorCode, "fail-tidak-sah")
    assert.equal(mismatch.diagnostic.stage, "gagal")
  })
})
