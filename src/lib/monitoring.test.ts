import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { estimatedNetRemovalL, ufRateFromMachine } from "./monitoring"

describe("pemantauan UF", () => {
  it("kira anggaran pembuangan cecair daripada berat", () => {
    const result = estimatedNetRemovalL(70.4, 68.1)
    assert.equal(result.value, 2.3)
    assert.equal(result.reason, null)
  })

  it("tidak menggantikan berat yang tiada", () => {
    const result = estimatedNetRemovalL(70, null)
    assert.equal(result.value, null)
    assert.match(result.reason ?? "", /data tidak lengkap/)
  })

  it("kira kadar UF mesin dengan berat kering", () => {
    const result = ufRateFromMachine({
      machineUfMl: 2500,
      actualDurationMin: 240,
      weightKg: 70,
      weightLabel: "berat kering sesi",
    })
    assert.equal(result.mlPerHour.value, 625)
    assert.equal(result.mlPerKgHour.value, 8.9)
    assert.equal(result.weightLabel, "berat kering sesi")
  })

  it("tidak mengira kadar jika tempoh sifar atau tiada isipadu mesin", () => {
    const result = ufRateFromMachine({
      machineUfMl: null,
      actualDurationMin: 0,
      weightKg: 70,
      weightLabel: "berat kering sesi",
    })
    assert.equal(result.mlPerHour.value, null)
    assert.equal(result.mlPerKgHour.value, null)
  })
})
