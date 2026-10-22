'use client'

import { useEffect, useRef, useState } from 'react'
import { loadPhoto } from '@/src/features/photobooth/services/storage/photoStore'

type PhotoUrls = {
  /** Object URLs aligned with `ids`; null for empty slots, missing photos and photos still loading. */
  urls: Array<string | null>
  isLoading: boolean
  /** Ids whose photo is gone from this device or cannot be decoded. Empty while loading. */
  missingIds: string[]
}

/** Photos already decoded once in this page; decoding is only needed to catch corrupt blobs. */
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

type Snapshot = { key: string; urls: ReadonlyMap<string, string>; missing: ReadonlySet<string> }

const EMPTY: Snapshot = { key: '', urls: new Map(), missing: new Set() }

/**
 * Object URLs for stored photos, aligned with `ids`. URLs are reused while the
 * id stays referenced and revoked once the latest snapshot no longer uses them.
 */
export function usePhotoUrls(ids: Array<string | null>): PhotoUrls {
  const key = ids.join('|')
  const cacheRef = useRef(new Map<string, string>())
  const generationRef = useRef(0)
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY)

  useEffect(() => {
    const generation = ++generationRef.current
    const isCurrent = () => generationRef.current === generation
    const cache = cacheRef.current
    const wanted = new Set(key.split('|').filter(Boolean))

    void (async () => {
      const missing = new Set<string>()
      for (const id of wanted) {
        if (cache.has(id)) continue
        const blob = await loadPhoto(id).catch(() => null)
        const usable = blob !== null && (decodedIds.has(id) || (await canDecode(blob)))
        if (!isCurrent()) return
        if (!blob || !usable) {
          missing.add(id)
          continue
        }
        decodedIds.add(id)
        cache.set(id, URL.createObjectURL(blob))
      }

      const urls = new Map([...cache].filter(([id]) => wanted.has(id)))
      setSnapshot({ key, urls, missing })

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
  }, [key])

  useEffect(() => {
    const cache = cacheRef.current
    const generation = generationRef
    return () => {
      generation.current += 1
      cache.forEach((url) => URL.revokeObjectURL(url))
      cache.clear()
    }
  }, [])

  const isLoading = snapshot.key !== key
  return {
    // While a new set loads, photos that were already shown stay visible.
    urls: ids.map((id) => (id ? snapshot.urls.get(id) ?? null : null)),
    isLoading,
    missingIds: isLoading ? [] : ids.filter((id): id is string => id !== null && snapshot.missing.has(id)),
  }
}
