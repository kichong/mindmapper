// These helpers avoid pulling in a heavyweight PDF dependency by writing the
// small PDF document we need by hand.
const textEncoder = new TextEncoder()

const encodeString = (value: string): Uint8Array => textEncoder.encode(value)

export const convertDataUrlToBytes = (dataUrl: string): Uint8Array => {
  const commaIndex = dataUrl.indexOf(',')
  const base64Payload = commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1)
  const binary = atob(base64Payload)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

export const createPdfBytesFromJpeg = (
  imageBytes: Uint8Array,
  width: number,
  height: number,
): Uint8Array => {
  // The PDF spec lets us embed the JPEG bytes directly. We stitch together the
  // handful of PDF objects (catalog, page, image, and drawing commands) that
  // display the canvas snapshot at its natural size.
  const chunks: Uint8Array[] = []
  const objectOffsets: number[] = [0]
  let position = 0

  const pushChunk = (value: string | Uint8Array) => {
    const chunk = typeof value === 'string' ? encodeString(value) : value
    chunks.push(chunk)
    position += chunk.length
  }

  const addObject = (parts: (string | Uint8Array)[]) => {
    objectOffsets.push(position)
    parts.forEach(pushChunk)
  }

  pushChunk('%PDF-1.3\n')

  addObject(['1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'])
  addObject(['2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'])
  addObject([
    '3 0 obj\n',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] `,
    '/Resources << /XObject << /Im1 4 0 R >> /ProcSet [/PDF /ImageC] >> ',
    '/Contents 5 0 R >>\n',
    'endobj\n',
  ])

  addObject([
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
    imageBytes,
    '\nendstream\nendobj\n',
  ])

  const contentStream = `q\n${width} 0 0 ${height} 0 0 cm\n/Im1 Do\nQ\n`
  const contentBytes = encodeString(contentStream)

  addObject([
    `5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`,
    contentBytes,
    '\nendstream\nendobj\n',
  ])

  const crossReferenceOffset = position
  let crossReference = `xref\n0 ${objectOffsets.length}\n0000000000 65535 f \n`

  for (let index = 1; index < objectOffsets.length; index += 1) {
    crossReference += `${objectOffsets[index].toString().padStart(10, '0')} 00000 n \n`
  }

  const trailer = `trailer\n<< /Size ${objectOffsets.length} /Root 1 0 R >>\nstartxref\n${crossReferenceOffset}\n%%EOF\n`

  pushChunk(crossReference)
  pushChunk(trailer)

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const pdfBytes = new Uint8Array(totalLength)
  let offset = 0

  chunks.forEach((chunk) => {
    pdfBytes.set(chunk, offset)
    offset += chunk.length
  })

  return pdfBytes
}
