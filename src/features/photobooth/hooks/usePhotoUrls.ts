'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadPhotoResult } from '@/src/features/photobooth/services/storage/photoStore'

type PhotoUrls = {
  /** Object URLs aligned with `ids`; null for empty slots, problem photos and photos still loading. */
  urls: Array<string | null>
  isLoading: boolean
  /** Confirmed gone from this device. Empty while loading. */
  missingIds: string[]
  /**
   * Could not be read or decoded right now (storage error, memory pressure,
   * corrupt blob). They may still exist, so they are never dropped automatically.
   */
  unreadableIds: string[]
  /** Loads the problem photos again. */
  retry: () => void
}

/** Photos already decoded once in this page; decoding is only needed to catch unusable blobs. */
const decodedIds = new Set<string>()

async function canDecode(blob: Blob) {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob)
      const ok = bitmap.width > 0 && bitmap.height > 0
      bitmap.close()
      return ok
    }
    const url = URL.createObjectURL(blob)
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      return image.naturalWidth > 0
    } finally {
      URL.revokeObjectURL(url)
    }
  } catch {
    return false
  }
}

type Snapshot = {
  key: string
  urls: ReadonlyMap<string, string>
  missing: ReadonlySet<string>
  unreadable: ReadonlySet<string>
}

const EMPTY: Snapshot = { key: '', urls: new Map(), missing: new Set(), unreadable: new Set() }

/**
 * Object URLs for stored photos, aligned with `ids`. URLs are reused while the
 * id stays referenced and revoked once the latest snapshot no longer uses them.
 */
export function usePhotoUrls(ids: Array<string | null>): PhotoUrls {
  const key = ids.join('|')
  const cacheRef = useRef(new Map<string, string>())
  const generationRef = useRef(0)
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY)
  const [attempt, setAttempt] = useState(0)
  const loadKey = `${key}#${attempt}`

  useEffect(() => {
    const generation = ++generationRef.current
    const isCurrent = () => generationRef.current === generation
    const cache = cacheRef.current
    const wanted = new Set(key.split('|').filter(Boolean))

    void (async () => {
      const missing = new Set<string>()
      const unreadable = new Set<string>()
      for (const id of wanted) {
        if (cache.has(id)) continue
        const result = await loadPhotoResult(id).catch(() => ({ status: 'error' as const }))
        const usable = result.status === 'found' && (decodedIds.has(id) || (await canDecode(result.blob)))
        if (!isCurrent()) return
        if (result.status === 'missing') missing.add(id)
        else if (result.status === 'error' || !usable) unreadable.add(id)
        else {
          decodedIds.add(id)
          cache.set(id, URL.createObjectURL(result.blob))
        }
      }

      const urls = new Map([...cache].filter(([id]) => wanted.has(id)))
      setSnapshot({ key: loadKey, urls, missing, unreadable })

      // Revoke after React has committed the snapshot that no longer shows them,
      // unless a newer run has started (it takes over the cleanup).
      window.setTimeout(() => {
        if (!isCurrent()) return
        for (const [id, url] of cache) {
          if (wanted.has(id)) continue
          URL.revokeObjectURL(url)
          cache.delete(id)
        }
      }, 0)
    })()
  }, [key, loadKey])

  useEffect(() => {
    const cache = cacheRef.current
    const generation = generationRef
    return () => {
      generation.current += 1
      cache.forEach((url) => URL.revokeObjectURL(url))
      cache.clear()
    }
  }, [])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  const isLoading = snapshot.key !== loadKey
  const pick = (set: ReadonlySet<string>) =>
    isLoading ? [] : ids.filter((id): id is string => id !== null && set.has(id))

  return {
    // While a new set loads, photos that were already shown stay visible.
    urls: ids.map((id) => (id ? snapshot.urls.get(id) ?? null : null)),
    isLoading,
    missingIds: pick(snapshot.missing),
    unreadableIds: pick(snapshot.unreadable),
    retry,
  }
}
