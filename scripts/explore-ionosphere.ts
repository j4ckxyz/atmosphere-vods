const IONOSPHERE_DID = 'did:plc:lkeq4oghyhnztbu4dxr3joff'
const PLC_URL = `https://plc.directory/${IONOSPHERE_DID}`

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`)
  }
  return (await response.json()) as T
}

async function main() {
  console.log('=== Ionosphere PLC document ===')
  const plcDoc = await fetchJson<{
    service?: Array<{ id?: string; serviceEndpoint?: string }>
  }>(PLC_URL)
  console.log(JSON.stringify(plcDoc, null, 2))

  const pds = plcDoc.service?.find((entry) => entry.id === '#atproto_pds')?.serviceEndpoint
  if (!pds) {
    throw new Error('Could not resolve #atproto_pds service endpoint')
  }

  const basePds = pds.replace(/\/$/, '')
  console.log('\n=== Resolved PDS endpoint ===')
  console.log(basePds)

  const describeUrl = `${basePds}/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(IONOSPHERE_DID)}`
  console.log('\n=== describeRepo JSON ===')
  const describe = await fetchJson<{
    collections?: string[]
    [key: string]: unknown
  }>(describeUrl)
  console.log(JSON.stringify(describe, null, 2))

  const collections = (describe.collections ?? []).filter((name) => name.startsWith('tv.ionosphere.'))
  console.log('\n=== tv.ionosphere.* collections ===')
  console.log(JSON.stringify(collections, null, 2))

  for (const collection of collections) {
    const sampleUrl =
      `${basePds}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(IONOSPHERE_DID)}` +
      `&collection=${encodeURIComponent(collection)}&limit=5`

    console.log(`\n=== Sample records: ${collection} ===`)
    try {
      const sample = await fetchJson<Record<string, unknown>>(sampleUrl)
      console.log(JSON.stringify(sample, null, 2))
    } catch (error) {
      console.log(JSON.stringify({ collection, error: error instanceof Error ? error.message : 'unknown' }, null, 2))
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
