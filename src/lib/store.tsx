"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  approveApplication,
  clearLocal,
  deleteRemote,
  fetchAccount,
  listApplications,
  loadDatabase,
  persistCentre,
  persistLab,
  persistPatient,
  persistSession,
  pushDatabase,
  registerPatient,
  registerSuperAdmin,
  rejectApplication,
  superAdminExists,
  writeLocal,
} from "@/lib/db"
import { createSeed } from "@/lib/seed"
import { getSupabase, isSupabaseConfigured, signInWithPassword, signOut as supabaseSignOut, watchSession } from "@/lib/supabase"
import type {
  BloodRecord,
  Centre,
  Database,
  DataSource,
  DialysisSession,
  AccountProfile,
  Patient,
  PatientSignup,
} from "@/lib/types"
import type { Session } from "@supabase/supabase-js"

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
  accountEmail: string | null
  profile: AccountProfile | null
  applications: AccountProfile[]
  hasSuperAdmin: boolean | null
  setupError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUpPatient: (input: PatientSignup) => Promise<void>
  signUpSuperAdmin: (fullName: string, email: string, password: string) => Promise<void>
  approve: (account: AccountProfile) => Promise<void>
  reject: (userId: string) => Promise<void>
  signOut: () => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

const empty: Database = { centres: [], patients: [], sessions: [], labs: [] }

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Database>(empty)
  const [source, setSource] = useState<DataSource>(() => (isSupabaseConfigured() ? "supabase" : "local"))
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [centreFilter, setCentreFilter] = useState("all")
  const [accountEmail, setAccountEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [applications, setApplications] = useState<AccountProfile[]>([])
  const [hasSuperAdmin, setHasSuperAdmin] = useState<boolean | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)
  const authHold = useRef(false)
  const refreshRef = useRef<(session: Session | null) => void>(() => {})

  useEffect(() => {
    if (!isSupabaseConfigured()) {
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
    }

    let ticket = 0
    const refresh = (session: Session | null) => {
      const current = ++ticket
      if (!session) {
        setAccountEmail(null)
        setProfile(null)
        setApplications([])
        setData(empty)
        setSource("supabase")
        setError(null)
        void (async () => {
          try {
            const exists = await superAdminExists()
            if (current !== ticket) return
            setHasSuperAdmin(exists)
            setSetupError(null)
          } catch (error: unknown) {
            if (current !== ticket) return
            setHasSuperAdmin(null)
            setSetupError(error instanceof Error ? error.message : "Gagal menyemak super admin.")
          } finally {
            if (current === ticket) setReady(true)
          }
        })()
        return
      }
      const email = session.user.email ?? ""
      setAccountEmail(email)
      setSource("supabase")
      setSetupError(null)
      void (async () => {
        try {
          const nextProfile = await fetchAccount(session.user.id, email)
          const result = await loadDatabase()
          const nextApplications = nextProfile?.role === "super_admin" ? await listApplications() : []
          if (current !== ticket) return
          setProfile(nextProfile)
          setApplications(nextApplications)
          setData(result.data)
          setError(result.error)
        } catch (error: unknown) {
          if (current !== ticket) return
          setProfile(null)
          setApplications([])
          setData(empty)
          setError(error instanceof Error ? error.message : "Gagal memuatkan data.")
        } finally {
          if (current === ticket) setReady(true)
        }
      })()
    }

    refreshRef.current = refresh
    const stop = watchSession((session) => {
      if (!authHold.current) refresh(session)
    })
    return () => {
      ticket += 1
      stop()
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
      accountEmail,
      profile,
      applications,
      hasSuperAdmin,
      setupError,
      signIn: async (email, password) => {
        setBusy(true)
        setError(null)
        try {
          await signInWithPassword(email, password)
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Log masuk gagal."
          setError(message)
          throw error
        } finally {
          setBusy(false)
        }
      },
      signUpPatient: async (input) => {
        authHold.current = true
        setBusy(true)
        setError(null)
        try {
          await registerPatient(input)
          const session = (await getSupabase()?.auth.getSession())?.data.session ?? null
          authHold.current = false
          refreshRef.current(session)
        } catch (error: unknown) {
          authHold.current = false
          const message = error instanceof Error ? error.message : "Pendaftaran gagal."
          setError(message)
          throw error
        } finally {
          setBusy(false)
        }
      },
      signUpSuperAdmin: async (fullName, email, password) => {
        authHold.current = true
        setBusy(true)
        setError(null)
        try {
          await registerSuperAdmin(fullName, email, password)
          const session = (await getSupabase()?.auth.getSession())?.data.session ?? null
          authHold.current = false
          refreshRef.current(session)
        } catch (error: unknown) {
          authHold.current = false
          const message = error instanceof Error ? error.message : "Pendaftaran super admin gagal."
          setError(message)
          throw error
        } finally {
          setBusy(false)
        }
      },
      approve: async (account) => {
        setBusy(true)
        try {
          await approveApplication(account)
          const session = (await getSupabase()?.auth.getSession())?.data.session ?? null
          refreshRef.current(session)
        } finally {
          setBusy(false)
        }
      },
      reject: async (userId) => {
        setBusy(true)
        try {
          await rejectApplication(userId)
          const session = (await getSupabase()?.auth.getSession())?.data.session ?? null
          refreshRef.current(session)
        } finally {
          setBusy(false)
        }
      },
      signOut: async () => {
        setBusy(true)
        try {
          await supabaseSignOut()
          setAccountEmail(null)
          setProfile(null)
          setApplications([])
          setData(empty)
          setError(null)
        } finally {
          setBusy(false)
        }
      },
    }),
    [accountEmail, applications, busy, centreFilter, commitLocal, data, error, hasSuperAdmin, profile, ready, run, setupError, source],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error("useStore mesti digunakan dalam StoreProvider.")
  return store
}
