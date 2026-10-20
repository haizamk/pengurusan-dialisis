export type CalcResult = {
  value: number | null
  reason: string | null
}

function finitePositive(value: number | null | undefined) {
  return value != null && Number.isFinite(value) && value > 0
}

/** Anggaran pembuangan cecair bersih daripada perbezaan berat. Bukan bacaan mesin. */
export function estimatedNetRemovalL(
  preWeightKg: number | null | undefined,
  postWeightKg: number | null | undefined,
): CalcResult {
  if (!finitePositive(preWeightKg) || !finitePositive(postWeightKg)) {
    return { value: null, reason: "Tidak dapat dikira — data tidak lengkap" }
  }
  const litres = (preWeightKg as number) - (postWeightKg as number)
  if (litres < 0) {
    return { value: null, reason: "Tidak dapat dikira — berat selepas lebih tinggi daripada berat sebelum" }
  }
  return { value: Math.round(litres * 100) / 100, reason: null }
}

/** Kadar UF daripada isipadu sebenar mesin dan tempoh sebenar. */
export function ufRateFromMachine(input: {
  machineUfMl: number | null | undefined
  actualDurationMin: number | null | undefined
  weightKg: number | null | undefined
  weightLabel: string
}): {
  mlPerHour: CalcResult
  mlPerKgHour: CalcResult
  weightLabel: string
} {
  const volume = input.machineUfMl
  const minutes = input.actualDurationMin
  const weight = input.weightKg
  const missingVolume = volume == null || !Number.isFinite(volume) || volume < 0
  const missingTime = !finitePositive(minutes)
  if (missingVolume || missingTime) {
    const reason = "Tidak dapat dikira — data tidak lengkap"
    return {
      mlPerHour: { value: null, reason },
      mlPerKgHour: { value: null, reason },
      weightLabel: input.weightLabel,
    }
  }
  const hours = (minutes as number) / 60
  const mlPerHour = Math.round((volume as number) / hours)
  if (!finitePositive(weight)) {
    return {
      mlPerHour: { value: mlPerHour, reason: null },
      mlPerKgHour: { value: null, reason: "Tidak dapat dikira — data tidak lengkap" },
      weightLabel: input.weightLabel,
    }
  }
  const mlPerKgHour = Math.round(((volume as number) / ((weight as number) * hours)) * 10) / 10
  return {
    mlPerHour: { value: mlPerHour, reason: null },
    mlPerKgHour: { value: mlPerKgHour, reason: null },
    weightLabel: input.weightLabel,
  }
}
