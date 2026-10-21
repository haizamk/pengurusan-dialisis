import assert from "node:assert/strict"
import test from "node:test"

test("endpoint Gemini memerlukan kod ralat yang dikenali apabila kunci tiada", async () => {
  const { extractWithGemini } = await import("./lab-gemini-server")
  const previous = process.env.GEMINI_API_KEY
  delete process.env.GEMINI_API_KEY
  try {
    const result = await extractWithGemini(new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2, 3, 4]), {
      name: "a.pdf",
      type: "application/pdf",
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.errorCode, "gemini-tidak-tersedia")
  } finally {
    if (previous) process.env.GEMINI_API_KEY = previous
  }
})
