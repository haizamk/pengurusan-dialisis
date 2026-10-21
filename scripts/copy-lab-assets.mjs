import { existsSync } from "node:fs"
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { gunzipSync, gzipSync } from "node:zlib"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const pdfjs = path.join(root, "node_modules", "pdfjs-dist")
const core = path.join(root, "node_modules", "tesseract.js-core")
const worker = path.join(root, "node_modules", "tesseract.js", "dist", "worker.min.js")

await mkdir(path.join(root, "public", "pdfjs"), { recursive: true })
await cp(path.join(pdfjs, "cmaps"), path.join(root, "public", "pdfjs", "cmaps"), { recursive: true })
await cp(path.join(pdfjs, "standard_fonts"), path.join(root, "public", "pdfjs", "standard_fonts"), { recursive: true })

const coreOut = path.join(root, "public", "tesseract", "core")
await mkdir(coreOut, { recursive: true })
for (const name of [
  "tesseract-core-lstm.wasm",
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
]) {
  await cp(path.join(core, name), path.join(coreOut, name))
}
await cp(worker, path.join(root, "public", "tesseract", "worker.min.js"))

const langDir = path.join(root, "public", "tesseract", "lang")
const gzipPath = path.join(langDir, "eng.traineddata.gz")
await mkdir(langDir, { recursive: true })
await mkdir("/tmp/ppd-tesseract", { recursive: true })
const rawCandidates = ["/tmp/ppd-tesseract/eng.traineddata", path.join(root, "eng.traineddata")]
const rawPath = rawCandidates.find((item) => existsSync(item))
if (rawPath) {
  const raw = await readFile(rawPath)
  await writeFile(gzipPath, gzipSync(raw))
  await writeFile("/tmp/ppd-tesseract/eng.traineddata", raw)
} else if (!existsSync(gzipPath)) {
  const url = "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz"
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Model OCR eng tidak dapat dimuat turun (${response.status}).`)
  await writeFile(gzipPath, Buffer.from(await response.arrayBuffer()))
}
const raw = gunzipSync(await readFile(gzipPath))
await writeFile("/tmp/ppd-tesseract/eng.traineddata", raw)
await rm(path.join(root, "eng.traineddata"), { force: true })
