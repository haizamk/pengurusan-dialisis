import { round1, round2 } from "@/lib/format"

/** Penambahan cecair antara sesi yang biasanya diterima. */
export const IDWG_BAIK_PERCENT = 4
/** Melebihi ini dianggap penambahan cecair tinggi. */
export const IDWG_TINGGI_PERCENT = 5
/** Kadar UF yang mula perlu dipantau, mL/kg/jam. */
export const UF_RATE_PANTAU = 10
/** Had lazim untuk mengurangkan risiko hipotensi intradialisis. */
export const UF_RATE_TINGGI = 13
export const DRY_TOLERANCE_KG = 0.3
export const DEFAULT_DURATION_MIN = 240

export type UfBand = "baik" | "sederhana" | "tinggi" | "bawah-kering"
export type UfComparison = "seimbang" | "baki-cecair" | "bawah-kering" | "tiada-sejarah"
export type RateFlag = "selamat" | "pantau" | "tinggi"
export type PostFlag = "capai" | "atas" | "bawah" | "belum"

export type UfInput = {
  dryWeightKg: number
  arrivalWeightKg: number
  postWeightKg?: number | null
  lastPostWeightKg?: number | null
  durationMin?: number | null
}

export type UfAnalysis = {
  valid: boolean
  dryWeightKg: number
  arrivalWeightKg: number
  lastPostWeightKg: number | null
  postWeightKg: number | null
  durationMin: number
  /** Formula pengguna: berat selepas terakhir − berat semasa tiba. Negatif = berat naik. */
  ufSeterusnyaKg: number | null
  /** Berat semasa tiba − berat selepas terakhir. */
  idwgKg: number | null
  idwgPercent: number | null
  /** Berat semasa tiba − berat kering. */
  ufSasaranKg: number
  ufSasaranMl: number
  /** Berat semasa tiba − berat selepas sesi ini. */
  ufSebenarKg: number | null
  /** Berat selepas − berat kering. Positif = masih di atas. */
  bakiKeBeratKeringKg: number | null
  /** Sesi lepas: berat selepas − berat kering. */
  bakiSesiLepasKg: number | null
  ufRateMlPerKgHr: number | null
  band: UfBand
  comparison: UfComparison
  rateFlag: RateFlag | null
  postFlag: PostFlag
  messages: string[]
}

export function analyseUf(input: UfInput): UfAnalysis {
  const dry = input.dryWeightKg
  const arrival = input.arrivalWeightKg
  const duration =
    input.durationMin && input.durationMin > 0
      ? input.durationMin
      : DEFAULT_DURATION_MIN
  const lastPost = input.lastPostWeightKg ?? null
  const post = input.postWeightKg ?? null

  const invalid =
    !Number.isFinite(dry) ||
    !Number.isFinite(arrival) ||
    dry <= 0 ||
    arrival <= 0

  if (invalid) {
    return {
      valid: false,
      dryWeightKg: dry,
      arrivalWeightKg: arrival,
      lastPostWeightKg: lastPost,
      postWeightKg: post,
      durationMin: duration,
      ufSeterusnyaKg: null,
      idwgKg: null,
      idwgPercent: null,
      ufSasaranKg: 0,
      ufSasaranMl: 0,
      ufSebenarKg: null,
      bakiKeBeratKeringKg: null,
      bakiSesiLepasKg: null,
      ufRateMlPerKgHr: null,
      band: "baik",
      comparison: "tiada-sejarah",
      rateFlag: null,
      postFlag: "belum",
      messages: ["Berat kering dan berat semasa tiba perlu nombor yang sah."],
    }
  }

  const ufSasaranKg = round2(arrival - dry)
  const ufSasaranMl = Math.round(Math.max(0, ufSasaranKg) * 1000)
  const ufSeterusnyaKg = lastPost == null ? null : round2(lastPost - arrival)
  const idwgKg = lastPost == null ? null : round2(arrival - lastPost)
  const idwgPercent =
    idwgKg == null ? null : round1((idwgKg / dry) * 100)
  const gainPercent =
    idwgPercent ?? round1((Math.max(0, ufSasaranKg) / dry) * 100)
  const ufSebenarKg = post == null ? null : round2(arrival - post)
  const bakiKeBeratKeringKg = post == null ? null : round2(post - dry)
  const bakiSesiLepasKg = lastPost == null ? null : round2(lastPost - dry)

  const hours = duration / 60
  const ufRateMlPerKgHr =
    hours > 0 ? round1((Math.max(0, ufSasaranKg) * 1000) / dry / hours) : null

  let band: UfBand = "baik"
  if (ufSasaranKg < -DRY_TOLERANCE_KG) band = "bawah-kering"
  else if (gainPercent > IDWG_TINGGI_PERCENT) band = "tinggi"
  else if (gainPercent > IDWG_BAIK_PERCENT) band = "sederhana"

  let comparison: UfComparison = "tiada-sejarah"
  if (bakiSesiLepasKg != null) {
    if (bakiSesiLepasKg > DRY_TOLERANCE_KG) comparison = "baki-cecair"
    else if (bakiSesiLepasKg < -DRY_TOLERANCE_KG) comparison = "bawah-kering"
    else comparison = "seimbang"
  }

  const rateFlag: RateFlag | null =
    ufRateMlPerKgHr == null
      ? null
      : ufRateMlPerKgHr > UF_RATE_TINGGI
        ? "tinggi"
        : ufRateMlPerKgHr > UF_RATE_PANTAU
          ? "pantau"
          : "selamat"

  let postFlag: PostFlag = "belum"
  if (bakiKeBeratKeringKg != null) {
    if (Math.abs(bakiKeBeratKeringKg) <= DRY_TOLERANCE_KG) postFlag = "capai"
    else if (bakiKeBeratKeringKg > 0) postFlag = "atas"
    else postFlag = "bawah"
  }

  const messages = buildMessages({
    dry,
    arrival,
    ufSasaranKg,
    ufSasaranMl,
    ufSeterusnyaKg,
    idwgKg,
    idwgPercent,
    bakiSesiLepasKg,
    bakiKeBeratKeringKg,
    ufSebenarKg,
    ufRateMlPerKgHr,
    duration,
    band,
    comparison,
    rateFlag,
    postFlag,
  })

  return {
    valid: true,
    dryWeightKg: dry,
    arrivalWeightKg: arrival,
    lastPostWeightKg: lastPost,
    postWeightKg: post,
    durationMin: duration,
    ufSeterusnyaKg,
    idwgKg,
    idwgPercent,
    ufSasaranKg,
    ufSasaranMl,
    ufSebenarKg,
    bakiKeBeratKeringKg,
    bakiSesiLepasKg,
    ufRateMlPerKgHr,
    band,
    comparison,
    rateFlag,
    postFlag,
    messages,
  }
}

function kg(value: number) {
  return `${Math.abs(value).toLocaleString("ms-MY", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} kg`
}

function buildMessages(input: {
  dry: number
  arrival: number
  ufSasaranKg: number
  ufSasaranMl: number
  ufSeterusnyaKg: number | null
  idwgKg: number | null
  idwgPercent: number | null
  bakiSesiLepasKg: number | null
  bakiKeBeratKeringKg: number | null
  ufSebenarKg: number | null
  ufRateMlPerKgHr: number | null
  duration: number
  band: UfBand
  comparison: UfComparison
  rateFlag: RateFlag | null
  postFlag: PostFlag
}) {
  const messages: string[] = []
  const hours = input.duration / 60

  if (input.band === "bawah-kering") {
    messages.push(
      `Berat semasa tiba sudah ${kg(input.arrival - input.dry)} di bawah berat kering ${kg(input.dry)}. UF tidak disyorkan. Semak sama ada berat kering perlu dikemas kini bersama doktor.`,
    )
  } else if (input.comparison === "tiada-sejarah") {
    messages.push(
      `UF untuk capai berat kering ialah ${kg(input.ufSasaranKg)} (${input.ufSasaranMl.toLocaleString("ms-MY")} mL). Berat selepas sesi lepas belum ada, jadi formula UF seterusnya belum dikira.`,
    )
  } else if (input.idwgKg != null && input.ufSeterusnyaKg != null) {
    const arah =
      input.idwgKg > DRY_TOLERANCE_KG
        ? `berat naik ${kg(input.idwgKg)}`
        : input.idwgKg < -DRY_TOLERANCE_KG
          ? `berat turun ${kg(input.idwgKg)}`
          : "berat hampir sama"
    const peratus =
      input.idwgPercent == null
        ? ""
        : ` (${input.idwgPercent.toLocaleString("ms-MY", { maximumFractionDigits: 1 })}% berat kering)`
    messages.push(
      `UF seterusnya ${input.ufSeterusnyaKg.toLocaleString("ms-MY", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg: ${arah}${peratus} sejak sesi lepas.`,
    )

    if (input.comparison === "seimbang") {
      messages.push(
        `UF untuk capai berat kering ialah ${kg(input.ufSasaranKg)}. Angka ini hampir sama dengan penambahan cecair kerana sesi lepas tamat dekat berat kering.`,
      )
    } else if (input.comparison === "baki-cecair" && input.bakiSesiLepasKg != null) {
      messages.push(
        `UF untuk capai berat kering ialah ${kg(input.ufSasaranKg)}, lebih daripada cecair yang baru naik. Sesi lepas tamat ${kg(input.bakiSesiLepasKg)} di atas berat kering, jadi sesi ini perlu buang cecair baru bersama baki itu.`,
      )
    } else if (input.comparison === "bawah-kering" && input.bakiSesiLepasKg != null) {
      messages.push(
        `UF untuk capai berat kering hanya ${kg(input.ufSasaranKg)}. Sesi lepas sudah ${kg(input.bakiSesiLepasKg)} di bawah berat kering. Jangan tarik semua cecair yang naik.`,
      )
    }
  }

  if (input.band === "tinggi" && input.idwgPercent != null) {
    messages.push(
      `Penambahan cecair ${input.idwgPercent.toLocaleString("ms-MY", { maximumFractionDigits: 1 })}% melebihi 5% berat kering. Ini risiko beban cecair, sesak, dan tekanan darah tinggi.`,
    )
  } else if (input.band === "sederhana" && input.idwgPercent != null) {
    messages.push(
      `Penambahan cecair ${input.idwgPercent.toLocaleString("ms-MY", { maximumFractionDigits: 1 })}% berada antara 4% dan 5% berat kering. Pantau garam dan cecair sebelum sesi depan.`,
    )
  }

  if (input.band !== "bawah-kering" && input.rateFlag === "tinggi" && input.ufRateMlPerKgHr != null) {
    messages.push(
      `Pada sesi ${hours.toLocaleString("ms-MY", { maximumFractionDigits: 1 })} jam, kadar UF sasaran ${input.ufRateMlPerKgHr.toLocaleString("ms-MY", { maximumFractionDigits: 1 })} mL/kg/jam melebihi had lazim 13 mL/kg/jam. Pertimbang masa lebih panjang, atau semakan berat kering, supaya tarikan tidak terlalu laju.`,
    )
  } else if (input.band !== "bawah-kering" && input.rateFlag === "pantau" && input.ufRateMlPerKgHr != null) {
    messages.push(
      `Kadar UF sasaran ${input.ufRateMlPerKgHr.toLocaleString("ms-MY", { maximumFractionDigits: 1 })} mL/kg/jam menghampiri had 13 mL/kg/jam. Perhatikan tekanan darah dan kekejangan semasa sesi.`,
    )
  }

  if (input.postFlag === "capai") {
    messages.push("Berat selepas sesi ini sampai ke julat berat kering.")
  } else if (input.postFlag === "atas" && input.bakiKeBeratKeringKg != null) {
    messages.push(
      `Selepas sesi, masih ${kg(input.bakiKeBeratKeringKg)} di atas berat kering.`,
    )
  } else if (input.postFlag === "bawah" && input.bakiKeBeratKeringKg != null) {
    messages.push(
      `Selepas sesi, ${kg(input.bakiKeBeratKeringKg)} di bawah berat kering. Risiko kekejangan dan tekanan darah rendah lebih tinggi.`,
    )
  }

  if (input.ufSebenarKg != null && input.ufSebenarKg < -DRY_TOLERANCE_KG) {
    messages.push(
      "Berat selepas lebih tinggi daripada berat semasa tiba. Semak semula bacaan timbangan.",
    )
  }

  return messages
}

export const BAND_LABEL: Record<UfBand, string> = {
  baik: "Cecair terkawal",
  sederhana: "Pantau cecair",
  tinggi: "Cecair tinggi",
  "bawah-kering": "Di bawah berat kering",
}

export const POST_LABEL: Record<PostFlag, string> = {
  capai: "Capai berat kering",
  atas: "Masih di atas berat kering",
  bawah: "Di bawah berat kering",
  belum: "Berat selepas belum diisi",
}

export const RATE_LABEL: Record<RateFlag, string> = {
  selamat: "Kadar UF selamat",
  pantau: "Kadar UF perlu pantau",
  tinggi: "Kadar UF terlalu laju",
}
