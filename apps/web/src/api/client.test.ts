import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, fetchPdf } from './client'
import { DEFAULT_OPTIONS } from '../features/export/exportOptions'

const stubFetch = (res: Response | Error) =>
  vi.stubGlobal('fetch', vi.fn(() => (res instanceof Error ? Promise.reject(res) : Promise.resolve(res))))
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

describe('fetchPdf', () => {
  it('envoie les mêmes options en JSON pour l’aperçu et le téléchargement', async () => {
    for (const kind of ['preview', 'download'] as const) {
      stubFetch(new Response('%PDF-1.3', { headers: { 'Content-Type': 'application/pdf' } }))
      await fetchPdf('p1', kind, DEFAULT_OPTIONS)
      const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
      expect(url).toBe(`/api/projects/p1/document/${kind}`)
      expect(init.method).toBe('POST')
      expect(JSON.parse(init.body as string)).toEqual(DEFAULT_OPTIONS)
    }
  })

  it('retourne le Blob et le nom de fichier du serveur', async () => {
    stubFetch(new Response('%PDF-1.3', {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="cahier-des-charges-x-v1.pdf"' },
    }))
    const { blob, filename } = await fetchPdf('p1', 'download', DEFAULT_OPTIONS)
    expect(filename).toBe('cahier-des-charges-x-v1.pdf')
    expect(await blob.text()).toBe('%PDF-1.3')
  })

  it('transforme une 404 en ApiError avec le message serveur', async () => {
    stubFetch(json(404, { error: { code: 'NOT_FOUND', message: 'Projet introuvable' } }))
    await expect(fetchPdf('p1', 'preview', DEFAULT_OPTIONS)).rejects.toMatchObject({ status: 404, message: 'Projet introuvable' })
  })

  it('expose les erreurs de validation 400 par champ', async () => {
    stubFetch(json(400, { error: { message: 'Données invalides', details: [{ path: 'version', message: 'Version invalide' }] } }))
    const err = await fetchPdf('p1', 'preview', DEFAULT_OPTIONS).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(400)
    expect(err.fields).toEqual({ version: 'Version invalide' })
  })

  it('gère une erreur 500 sans corps JSON', async () => {
    stubFetch(new Response('<html>oops</html>', { status: 500 }))
    await expect(fetchPdf('p1', 'download', DEFAULT_OPTIONS)).rejects.toMatchObject({ status: 500, message: 'Erreur 500' })
  })

  it('gère une panne réseau', async () => {
    stubFetch(new TypeError('Failed to fetch'))
    await expect(fetchPdf('p1', 'preview', DEFAULT_OPTIONS)).rejects.toMatchObject({ status: 0 })
  })

  it('refuse une réponse qui n’est pas un PDF', async () => {
    stubFetch(new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } }))
    await expect(fetchPdf('p1', 'preview', DEFAULT_OPTIONS)).rejects.toMatchObject({ message: expect.stringContaining('PDF attendu') })
  })
})

describe('erreurs structurées', () => {
  it('expose le code et la réponse courante d’un conflit d’écriture', async () => {
    const current = { value: 'serveur', isReviewed: false, updatedAt: '2026-11-03T10:00:00.000Z' }
    stubFetch(json(409, { error: { code: 'STALE_WRITE', message: 'Modifiée entre-temps.', current } }))
    const err = await api.savePublicAnswer('t', 'q', { value: 'x', expectedUpdatedAt: null }).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 409, code: 'STALE_WRITE', current })
  })

  it('n’envoie jamais le jeton d’administration aux routes publiques et encode le jeton du lien', async () => {
    stubFetch(json(404, { error: { message: 'Lien introuvable' } }))
    await api.getPublicQuestionnaire('abc/../x').catch(() => {})
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/public/questionnaires/abc%2F..%2Fx')
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })
})
