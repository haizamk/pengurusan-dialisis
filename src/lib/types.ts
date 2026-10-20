export type Sex = "lelaki" | "perempuan"
export type AccessType = "fistula" | "graft" | "kateter"
export type DataSource = "local" | "supabase"
export type StaffRole = "pentadbir" | "staf"

export type StaffProfile = {
  userId: string
  email: string
  fullName: string
  role: StaffRole
  centreIds: string[]
}

export type Centre = {
  id: string
  name: string
  city: string
  state: string
  phone: string
}

export type Patient = {
  id: string
  fullName: string
  mrn: string
  sex: Sex
  dateOfBirth: string
  phone: string
  centreId: string
  dryWeightKg: number
  accessType: AccessType
  accessSite: string
  schedule: string
  diagnosis: string
  notes: string
  active: boolean
}

export type DialysisSession = {
  id: string
  patientId: string
  centreId: string
  sessionDate: string
  arrivalWeightKg: number
  postWeightKg: number | null
  dryWeightKg: number
  durationMin: number
  systolicPre: number | null
  diastolicPre: number | null
  systolicPost: number | null
  diastolicPost: number | null
  notes: string
  createdAt: string
}

export type BloodRecord = {
  id: string
  patientId: string
  takenOn: string
  hemoglobin: number | null
  ureaPre: number | null
  ureaPost: number | null
  creatinine: number | null
  potassium: number | null
  phosphate: number | null
  calcium: number | null
  sodium: number | null
  albumin: number | null
  notes: string
  createdAt: string
}

export type Database = {
  centres: Centre[]
  patients: Patient[]
  sessions: DialysisSession[]
  labs: BloodRecord[]
}
