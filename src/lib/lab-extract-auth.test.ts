import assert from "node:assert/strict"
import test from "node:test"

test("ekstraksi melalui Nous memerlukan NOUS_API_KEY apabila kunci tiada", async () => {
  const { extractWithGemini } = await import("./lab-gemini-server")
  const previousNous = process.env.NOUS_API_KEY
  delete process.env.NOUS_API_KEY
  try {
    const result = await extractWithGemini(new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2, 3, 4]), {
      name: "a.pdf",
      type: "application/pdf",
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.errorCode, "tiada-enjin")
      assert.match(result.errorMessage, /NOUS_API_KEY/)
    }
  } finally {
    if (previousNous === undefined) delete process.env.NOUS_API_KEY
    else process.env.NOUS_API_KEY = previousNous
  }
})
