"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  clearLocal,
  deleteRemote,
  loadDatabase,
  persistCentre,
  persistLab,
  persistPatient,
  persistSession,
  pushDatabase,
  writeLocal,
} from "@/lib/db"
import { createSeed } from "@/lib/seed"
import type {
  BloodRecord,
  Centre,
  Database,
  DataSource,
  DialysisSession,
  Patient,
} from "@/lib/types"

type StoreValue = {
  ready: boolean
  busy: boolean
  source: DataSource
  error: string | null
  centres: Centre[]
  patients: Patient[]
  sessions: DialysisSession[]
  labs: BloodRecord[]
  centreFilter: string
  setCentreFilter: (id: string) => void
  saveCentre: (centre: Centre, mode: "insert" | "update") => Promise<void>
  savePatient: (patient: Patient, mode: "insert" | "update") => Promise<void>
  removePatient: (id: string) => Promise<void>
  saveSession: (session: DialysisSession, mode: "insert" | "update") => Promise<void>
  removeSession: (id: string) => Promise<void>
  saveLab: (lab: BloodRecord, mode: "insert" | "update") => Promise<void>
  removeLab: (id: string) => Promise<void>
  resetLocalDemo: () => void
  seedRemoteDemo: () => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

const empty: Database = { centres: [], patients: [], sessions: [], labs: [] }

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Database>(empty)
  const [source, setSource] = useState<DataSource>("local")
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [centreFilter, setCentreFilter] = useState("all")

  useEffect(() => {
    let cancelled = false
    loadDatabase()
      .then((result) => {
        if (cancelled) return
        setData(result.data)
        setSource(result.source)
        setError(result.error)
        if (result.source === "local") writeLocal(result.data)
        setReady(true)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const seeded = createSeed()
        writeLocal(seeded)
        setData(seeded)
        setSource("local")
        setError(error instanceof Error ? error.message : "Gagal memuatkan data.")
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const commitLocal = useCallback((next: Database) => {
    setData(next)
    writeLocal(next)
  }, [])

  const run = useCallback(
    async (work: () => Promise<void>, apply: (current: Database) => Database) => {
      setBusy(true)
      try {
        if (source === "supabase") await work()
        setData((current) => {
          const next = apply(current)
          if (source === "local") writeLocal(next)
          return next
        })
      } finally {
        setBusy(false)
      }
    },
    [source],
  )

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      busy,
      source,
      error,
      centres: data.centres,
      patients: data.patients,
      sessions: data.sessions,
      labs: data.labs,
      centreFilter,
      setCentreFilter,
      saveCentre: (centre, mode) =>
        run(
          () => persistCentre(centre, mode),
          (current) => ({
            ...current,
            centres:
              mode === "insert"
                ? [...current.centres, centre]
                : current.centres.map((item) => (item.id === centre.id ? centre : item)),
          }),
        ),
      savePatient: (patient, mode) =>
        run(
          () => persistPatient(patient, mode),
          (current) => ({
            ...current,
            patients:
              mode === "insert"
                ? [...current.patients, patient]
                : current.patients.map((item) => (item.id === patient.id ? patient : item)),
          }),
        ),
      removePatient: (id) =>
        run(
          async () => {
            const sessions = data.sessions.filter((session) => session.patientId === id)
            const labs = data.labs.filter((lab) => lab.patientId === id)
            for (const session of sessions) await deleteRemote("dialysis_sessions", session.id)
            for (const lab of labs) await deleteRemote("blood_records", lab.id)
            await deleteRemote("patients", id)
          },
          (current) => ({
            ...current,
            patients: current.patients.filter((patient) => patient.id !== id),
            sessions: current.sessions.filter((session) => session.patientId !== id),
            labs: current.labs.filter((lab) => lab.patientId !== id),
          }),
        ),
      saveSession: (session, mode) =>
        run(
          () => persistSession(session, mode),
          (current) => ({
            ...current,
            sessions:
              mode === "insert"
                ? [...current.sessions, session]
                : current.sessions.map((item) => (item.id === session.id ? session : item)),
          }),
        ),
      removeSession: (id) =>
        run(
          () => deleteRemote("dialysis_sessions", id),
          (current) => ({
            ...current,
            sessions: current.sessions.filter((session) => session.id !== id),
          }),
        ),
      saveLab: (lab, mode) =>
        run(
          () => persistLab(lab, mode),
          (current) => ({
            ...current,
            labs:
              mode === "insert"
                ? [...current.labs, lab]
                : current.labs.map((item) => (item.id === lab.id ? lab : item)),
          }),
        ),
      removeLab: (id) =>
        run(
          () => deleteRemote("blood_records", id),
          (current) => ({
            ...current,
            labs: current.labs.filter((lab) => lab.id !== id),
          }),
        ),
      resetLocalDemo: () => {
        const seed = createSeed()
        clearLocal()
        commitLocal(seed)
        setSource("local")
        setError(null)
        setReady(true)
      },
      seedRemoteDemo: async () => {
        const seed = createSeed()
        setBusy(true)
        try {
          await pushDatabase(seed)
          setData(seed)
          setSource("supabase")
          setError(null)
        } finally {
          setBusy(false)
        }
      },
    }),
    [busy, centreFilter, commitLocal, data, error, ready, run, source],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error("useStore mesti digunakan dalam StoreProvider.")
  return store
}
