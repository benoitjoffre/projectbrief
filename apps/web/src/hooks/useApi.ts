import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'

interface Settled<T> {
  key: string
  data?: T
  error?: ApiError
}

/** GET d'une ressource. `loading` est dérivé : le résultat ne correspond pas encore à la clé courante. */
export function useApi<T>(path: string) {
  const [tick, setTick] = useState(0)
  const [result, setResult] = useState<Settled<T> | null>(null)
  const key = `${path}#${tick}`

  useEffect(() => {
    let cancelled = false
    api
      .get<T>(path)
      .then((data) => !cancelled && setResult({ key, data }))
      .catch((error: ApiError) => !cancelled && setResult({ key, error }))
    return () => {
      cancelled = true
    }
  }, [path, key])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  const settled = result?.key === key ? result : null
  return { data: settled?.data, error: settled?.error, loading: !settled, reload }
}
