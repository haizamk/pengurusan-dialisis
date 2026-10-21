export async function textFromPdfBytes(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes)
  const { extractText } = await import("unpdf")
  const { text } = await extractText(copy, { mergePages: true })
  return text.replace(/\u0000/g, " ").trim()
}
