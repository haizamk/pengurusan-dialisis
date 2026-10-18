import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { judgeMarker, judgeUrr, summariseLab, ureaReductionRatio } from "./blood"
import type { BloodRecord } from "./types"

function lab(partial: Partial<BloodRecord>): BloodRecord {
  return {
    id: "lab-1",
    patientId: "pt-1",
    takenOn: "2026-10-16",
    hemoglobin: null,
    ureaPre: null,
    ureaPost: null,
    creatinine: null,
    potassium: null,
    phosphate: null,
    calcium: null,
    sodium: null,
    albumin: null,
    notes: "",
    createdAt: "2026-10-16T00:00:00.000Z",
    ...partial,
  }
}

describe("darah", () => {
  it("kira URR dan sasaran 65%", () => {
    assert.equal(ureaReductionRatio(22.4, 6.1), 72.8)
    assert.equal(judgeUrr(72.8), "sasaran")
    assert.equal(judgeUrr(62), "tinggi")
    assert.equal(judgeUrr(57), "rendah")
    assert.equal(ureaReductionRatio(10, 12), null)
  })

  it("benderakan kalium kritikal dan hemoglobin rendah", () => {
    assert.equal(judgeMarker("potassium", 6.4), "kritikal-tinggi")
    assert.equal(judgeMarker("potassium", 5.2), "sasaran")
    assert.equal(judgeMarker("hemoglobin", 8.9), "rendah")
    assert.equal(judgeMarker("hemoglobin", 11), "sasaran")
    assert.equal(judgeMarker("albumin", 31), "rendah")
    assert.equal(judgeMarker("creatinine", 900), "trend")
  })

  it("ringkaskan hanya nilai di luar sasaran", () => {
    const flags = summariseLab(
      lab({
        hemoglobin: 11,
        potassium: 6.2,
        phosphate: 1.4,
        ureaPre: 28,
        ureaPost: 12,
      }),
    )
    assert.deepEqual(
      flags.map((flag) => flag.key),
      ["potassium", "urr"],
    )
    assert.equal(flags[0]?.serious, true)
  })
})
