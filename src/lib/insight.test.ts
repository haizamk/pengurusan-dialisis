import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { analyseRecords } from "./insight"
import type { Patient } from "./types"

const patient: Patient = {
  id: "p1",
  fullName: "Ali",
  mrn: "1",
  sex: "lelaki",
  dateOfBirth: "1970-01-01",
  phone: "",
  centreId: "c1",
  dryWeightKg: 70,
  accessType: "fistula",
  accessSite: "",
  schedule: "",
  diagnosis: "",
  notes: "",
  active: true,
}

describe("analisis rekod", () => {
  it("menolak analisis apabila tiada rekod", () => {
    const result = analyseRecords(patient, [], [])
    assert.equal(result.sufficient, false)
    assert.match(result.message, /belum mencukupi/)
  })

  it("memetik tarikh dan nilai sebenar", () => {
    const result = analyseRecords(
      patient,
      [
        {
          id: "a",
          patientId: "p1",
          centreId: "c1",
          sessionDate: "2026-01-01",
          arrivalWeightKg: 72,
          postWeightKg: 70,
          dryWeightKg: 70,
          durationMin: 240,
          systolicPre: null,
          diastolicPre: null,
          systolicPost: null,
          diastolicPost: null,
          notes: "",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "b",
          patientId: "p1",
          centreId: "c1",
          sessionDate: "2026-02-01",
          arrivalWeightKg: 73,
          postWeightKg: 70.5,
          dryWeightKg: 70,
          durationMin: 240,
          systolicPre: null,
          diastolicPre: null,
          systolicPost: null,
          diastolicPost: null,
          notes: "",
          createdAt: "2026-02-01T00:00:00.000Z",
        },
      ],
      [],
    )
    assert.equal(result.sufficient, true)
    assert.match(result.observations.join(" "), /73 kg/)
    assert.match(result.disclaimer, /bukan diagnosis/)
  })
})