'use client'

import { useEffect, useRef, useState } from 'react'
import { loadPhoto } from '@/src/features/photobooth/services/storage/photoStore'

type PhotoUrls = { urls: Array<string | null>; isLoading: boolean }

/**
 * Object URLs for stored photos, aligned with `ids`. URLs are reused across
 * renders while the id stays referenced and revoked once it is not.
 */
export function usePhotoUrls(ids: Array<string | null>): PhotoUrls {
  const key = ids.join('|')
  const cacheRef = useRef(new Map<string, string>())
  const [snapshot, setSnapshot] = useState<{ key: string; byId: ReadonlyMap<string, string> }>({
    key: '',
    byId: new Map(),
  })

  useEffect(() => {
    let cancelled = false
    const cache = cacheRef.current
    const wanted = new Set(key.split('|').filter(Boolean))

    for (const [id, url] of cache) {
      if (!wanted.has(id)) {
        URL.revokeObjectURL(url)
        cache.delete(id)
      }
    }

    void (async () => {
      for (const id of wanted) {
        if (cache.has(id)) continue
        const blob = await loadPhoto(id).catch(() => null)
        if (cancelled) return
        if (blob) cache.set(id, URL.createObjectURL(blob))
      }
      setSnapshot({ key, byId: new Map(cache) })
    })()

    return () => {
      cancelled = true
    }
  }, [key])

  useEffect(() => {
    const cache = cacheRef.current
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url))
      cache.clear()
    }
  }, [])

  return {
    urls: ids.map((id) => (id ? snapshot.byId.get(id) ?? null : null)),
    isLoading: snapshot.key !== key,
  }
}
