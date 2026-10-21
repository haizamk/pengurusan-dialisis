import assert from "node:assert/strict"
import test from "node:test"
import { applyConfirmation, applyReextraction, draftFromText, importLabDocument, memoryArchiveStore, recordsForPatient, withoutDuplicateConfirmed } from "./lab-archive"
import { PATIENT_STATUS } from "./pdf-text"

const PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
))

test("imej disimpan tanpa nilai yang diteka", async () => {
  const store = memoryArchiveStore()
  const first = await importLabDocument(store, {
    patientId: "pesakit-a",
    fileName: "makmal.png",
    mime: "image/png",
    bytes: PNG,
    text: "",
    note: "Imej disimpan.",
    extractionStatus: "tiada_teks",
    allowDuplicate: false,
    uploadedAt: "2026-03-12T00:00:00.000Z",
  })
  assert.equal(first.error, null)
  assert.equal(first.observations.length, 0)
  assert.equal(first.document?.reviewStatus, "perlu_semakan")
  const saved = await store.getFile(first.document!.id)
  assert.equal(saved?.bytes.length, PNG.length)
  assert.equal(saved?.bytes[0], 0x89)
})

test("pdf teks menjadi draf semakan dan tidak terus disahkan", () => {
  const draft = draftFromText({
    id: "dokumen-1",
    patientId: "pesakit-a",
    fileName: "makmal.pdf",
    mime: "application/pdf",
    byteSize: 20,
    sha256: "abc",
    text: "Tarikh: 2026-03-12\nHemoglobin 10.4 g/dL",
    uploadedAt: "2026-03-12T00:00:00.000Z",
    note: "Teks dibaca.",
    extractionStatus: "terbaca",
  })
  assert.equal(draft.observations[0]?.status, "perlu_semakan")
  assert.equal(draft.observations[0]?.value, 10.4)
  assert.equal(draft.observations[0]?.unit, "g/dl")
  assert.equal(draft.document.patientId, "pesakit-a")
})

test("laporan baharu tidak memadam laporan lama dan pendua disekat", async () => {
  const store = memoryArchiveStore()
  const input = {
    patientId: "pesakit-a",
    fileName: "makmal.png",
    mime: "image/png",
    bytes: PNG,
    text: "",
    note: "Imej.",
    extractionStatus: "tiada_teks" as const,
    allowDuplicate: false,
    uploadedAt: "2026-03-12T00:00:00.000Z",
  }
  const first = await importLabDocument(store, input)
  const second = await importLabDocument(store, { ...input, fileName: "salinan.png" })
  assert.equal(second.duplicate?.id, first.document?.id)
  assert.equal(store.read().documents.length, 1)
  const other = await importLabDocument(store, {
    ...input,
    fileName: "lain.png",
    bytes: Uint8Array.from([...PNG, 1]),
    uploadedAt: "2026-04-01T00:00:00.000Z",
  })
  assert.equal(other.document?.id === first.document?.id, false)
  assert.equal(store.read().documents.length, 2)
  const original = await store.getFile(first.document!.id)
  assert.equal(original?.bytes.length, PNG.length)
})

test("pengesahan kekal pada pesakit yang betul dan pendua nilai disekat", () => {
  const draft = draftFromText({
    id: "dokumen-1",
    patientId: "pesakit-a",
    fileName: "makmal.pdf",
    mime: "application/pdf",
    byteSize: 20,
    sha256: "abc",
    text: "Tarikh: 2026-03-12\nHemoglobin 10.4 g/dL",
    uploadedAt: "2026-03-12T00:00:00.000Z",
    note: "Teks dibaca.",
    extractionStatus: "terbaca",
  })
  const row = draft.observations[0]!
  const blocked = applyConfirmation(row, {
    value: 10.4,
    unit: "g/dL",
    takenOn: "2026-03-12",
    standardKey: "hemoglobin",
    originalName: "Hemoglobin",
    acceptUnclear: false,
    updatedAt: "2026-03-13T00:00:00.000Z",
  })
  assert.equal("error" in blocked, false)
  if ("error" in blocked) return
  assert.equal(blocked.row.patientId, "pesakit-a")
  assert.equal(blocked.row.status, "disahkan")
  const again = { ...blocked.row, id: "lain" }
  const { saved, skipped } = withoutDuplicateConfirmed([blocked.row], [again])
  assert.equal(saved.length, 0)
  assert.equal(skipped.length, 1)
  assert.deepEqual(recordsForPatient([blocked.row, { ...blocked.row, id: "x", patientId: "pesakit-b" }], "pesakit-a").map((item) => item.patientId), ["pesakit-a"])
})

test("bacaan semula tidak menggandakan keputusan dan tidak memadam fail asal", async () => {
  const store = memoryArchiveStore()
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2, 3, 4])
  const pending = await importLabDocument(store, {
    patientId: "pesakit-a",
    fileName: "makmal.pdf",
    mime: "application/pdf",
    bytes,
    text: "",
    note: PATIENT_STATUS.reading,
    extractionStatus: "gagal",
    processingStatus: "membaca",
    allowDuplicate: false,
    uploadedAt: "2026-03-12T00:00:00.000Z",
    id: "dokumen-ulang",
  })
  assert.equal(pending.document?.processingStatus, "membaca")
  assert.equal(pending.document?.note, PATIENT_STATUS.reading)
  assert.equal(pending.observations.length, 0)
  const input = {
    id: "dokumen-ulang",
    patientId: "pesakit-a",
    fileName: "makmal.pdf",
    mime: "application/pdf",
    byteSize: bytes.length,
    sha256: pending.document!.sha256,
    text: "Tarikh: 2026-03-12\nHemoglobin 10.4 g/dL",
    uploadedAt: "2026-03-12T00:00:00.000Z",
    note: PATIENT_STATUS.found,
    extractionStatus: "separa" as const,
  }
  const first = applyReextraction(store.read(), "dokumen-ulang", draftFromText(input))
  const second = applyReextraction(first, "dokumen-ulang", draftFromText(input))
  const rows = second.observations.filter((item) => item.documentId === "dokumen-ulang")
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.status, "perlu_semakan")
  assert.equal(rows[0]?.value, 10.4)
  const confirmed = applyConfirmation(rows[0]!, {
    value: 10.4,
    unit: "g/dL",
    takenOn: "2026-03-12",
    standardKey: "hemoglobin",
    originalName: "Hemoglobin",
    acceptUnclear: true,
    updatedAt: "2026-03-13T00:00:00.000Z",
  })
  assert.equal("error" in confirmed, false)
  if ("error" in confirmed) return
  const kept = applyReextraction({ ...second, observations: [confirmed.row] }, "dokumen-ulang", draftFromText(input))
  const hemoglobin = kept.observations.filter((item) => item.standardKey === "hemoglobin" && item.value === 10.4)
  assert.equal(hemoglobin.length, 1)
  assert.equal(hemoglobin[0]?.status, "disahkan")
  const failed = applyReextraction(kept, "dokumen-ulang", draftFromText({ ...input, text: "", note: PATIENT_STATUS.failed, extractionStatus: "gagal" }))
  assert.equal(failed.documents[0]?.processingStatus, "gagal")
  assert.equal(failed.documents[0]?.note, PATIENT_STATUS.failed)
  assert.equal(failed.observations.filter((item) => item.status === "disahkan" && item.value === 10.4).length, 1)
  assert.equal((await store.getFile("dokumen-ulang"))?.bytes.length, bytes.length)
})

test("arkib pesakit bertahan selepas diserialkan dan tidak terbuka kepada pesakit lain", async () => {
  const store = memoryArchiveStore()
  const saved = await importLabDocument(store, {
    patientId: "pesakit-a",
    fileName: "makmal.pdf",
    mime: "application/pdf",
    bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 9]),
    text: "Tarikh: 2026-03-12\nHemoglobin 10.4 g/dL",
    note: "Teks dibaca.",
    extractionStatus: "terbaca",
    allowDuplicate: false,
    uploadedAt: "2026-03-12T00:00:00.000Z",
  })
  const restored = memoryArchiveStore()
  restored.write(JSON.parse(JSON.stringify(store.read())))
  const file = await store.getFile(saved.document!.id)
  await restored.putFile(saved.document!.id, file!)
  assert.equal(restored.read().observations[0]?.value, 10.4)
  assert.equal(restored.read().documents[0]?.patientId, "pesakit-a")
  assert.equal(recordsForPatient(restored.read().documents, "pesakit-b").length, 0)
  assert.equal(recordsForPatient(restored.read().observations, "pesakit-b").length, 0)
  assert.equal((await restored.getFile(saved.document!.id))?.bytes[0], 0x25)
})

test("nilai tidak pasti tidak boleh disahkan tanpa semakan eksplisit", () => {
  const draft = draftFromText({
    id: "dokumen-2",
    patientId: "pesakit-a",
    fileName: "makmal.pdf",
    mime: "application/pdf",
    byteSize: 10,
    sha256: "def",
    text: "Albumin",
    uploadedAt: "2026-03-12T00:00:00.000Z",
    note: "Sebahagian.",
    extractionStatus: "separa",
  })
  const row = draft.observations[0]!
  assert.equal(row.uncertain, true)
  assert.equal(row.value, null)
  const refused = applyConfirmation(row, {
    value: 32,
    unit: "g/L",
    takenOn: "2026-03-12",
    standardKey: "albumin",
    originalName: "Albumin",
    acceptUnclear: false,
    updatedAt: "2026-03-13T00:00:00.000Z",
  })
  assert.equal("error" in refused, true)
})
