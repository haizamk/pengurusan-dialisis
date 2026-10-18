import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { analyseUf } from "./uf"

describe("analyseUf", () => {
  it("samakan UF seterusnya dengan UF sasaran bila sesi lepas tamat pada berat kering", () => {
    const result = analyseUf({
      dryWeightKg: 54.5,
      arrivalWeightKg: 56.1,
      lastPostWeightKg: 54.5,
      durationMin: 240,
    })

    assert.equal(result.ufSeterusnyaKg, -1.6)
    assert.equal(result.idwgKg, 1.6)
    assert.equal(result.idwgPercent, 2.9)
    assert.equal(result.ufSasaranKg, 1.6)
    assert.equal(result.comparison, "seimbang")
    assert.equal(result.band, "baik")
    assert.equal(result.rateFlag, "selamat")
    assert.ok(result.messages.some((line) => line.includes("hampir sama")))
  })

  it("naikkan UF sasaran bila sesi lepas masih di atas berat kering", () => {
    const result = analyseUf({
      dryWeightKg: 61.5,
      arrivalWeightKg: 66.2,
      lastPostWeightKg: 62.4,
      postWeightKg: 63,
      durationMin: 240,
    })

    assert.equal(result.ufSeterusnyaKg, -3.8)
    assert.equal(result.idwgKg, 3.8)
    assert.equal(result.idwgPercent, 6.2)
    assert.equal(result.ufSasaranKg, 4.7)
    assert.equal(result.bakiSesiLepasKg, 0.9)
    assert.equal(result.comparison, "baki-cecair")
    assert.equal(result.band, "tinggi")
    assert.equal(result.ufRateMlPerKgHr, 19.1)
    assert.equal(result.rateFlag, "tinggi")
    assert.equal(result.postFlag, "atas")
  })

  it("kekalkan UF sasaran lebih kecil bila sesi lepas di bawah berat kering", () => {
    const result = analyseUf({
      dryWeightKg: 49.2,
      arrivalWeightKg: 50.1,
      lastPostWeightKg: 48.4,
      durationMin: 240,
    })

    assert.equal(result.idwgKg, 1.7)
    assert.equal(result.ufSasaranKg, 0.9)
    assert.equal(result.ufSeterusnyaKg, -1.7)
    assert.equal(result.comparison, "bawah-kering")
    assert.equal(result.band, "baik")
    assert.ok(result.messages.some((line) => line.includes("Jangan tarik semua cecair")))
  })

  it("tidak mengesyorkan UF bila berat tiba sudah di bawah berat kering", () => {
    const result = analyseUf({
      dryWeightKg: 50,
      arrivalWeightKg: 49.2,
      lastPostWeightKg: 49.4,
      durationMin: 240,
    })

    assert.equal(result.band, "bawah-kering")
    assert.equal(result.ufSasaranKg, -0.8)
    assert.equal(result.ufSasaranMl, 0)
    assert.ok(result.messages[0]?.includes("UF tidak disyorkan"))
  })

  it("tandakan kadar UF terlalu laju pada tarikan besar dalam 4 jam", () => {
    const result = analyseUf({
      dryWeightKg: 50,
      arrivalWeightKg: 54,
      durationMin: 240,
    })

    assert.equal(result.ufRateMlPerKgHr, 20)
    assert.equal(result.rateFlag, "tinggi")
    assert.equal(result.comparison, "tiada-sejarah")
    assert.equal(result.ufSeterusnyaKg, null)
  })

  it("tolak bacaan yang tidak sah", () => {
    const result = analyseUf({ dryWeightKg: 0, arrivalWeightKg: 60 })
    assert.equal(result.valid, false)
  })
})
