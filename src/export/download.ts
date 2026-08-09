export interface DownloadEnvironment {
  readonly document: Pick<Document, 'body' | 'createElement'>
  readonly url: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>
  readonly defer: (callback: () => void) => void
}

function browserEnvironment(): DownloadEnvironment {
  return {
    document,
    url: URL,
    defer: (callback) => window.setTimeout(callback, 0),
  }
}

export function safeDownloadName(value: string, extension: string): string {
  const base = value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  const cleanExtension = extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return `${base || 'melody-forge'}.${cleanExtension || 'bin'}`
}

export function downloadBlob(
  blob: Blob,
  filename: string,
  environment: DownloadEnvironment = browserEnvironment(),
): void {
  const objectUrl = environment.url.createObjectURL(blob)
  const anchor = environment.document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.hidden = true
  environment.document.body.append(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    environment.defer(() => environment.url.revokeObjectURL(objectUrl))
  }
}

export function downloadText(
  text: string,
  filename: string,
  environment?: DownloadEnvironment,
): void {
  downloadBlob(
    new Blob([text], { type: 'application/json;charset=utf-8' }),
    filename,
    environment,
  )
}

export function downloadBytes(
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
  environment?: DownloadEnvironment,
): void {
  const stableBuffer = Uint8Array.from(bytes).buffer
  downloadBlob(new Blob([stableBuffer], { type: mimeType }), filename, environment)
}
