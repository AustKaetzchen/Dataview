import { decodeRawGeoPngBuffer } from './decoder'
import { DataFormat, DecodedRaster } from './types'

export type PngDecoderInMessage = {
  reqId: number
  buffer: ArrayBuffer
  format: DataFormat
}

export type PngDecoderOutMessage =
  | {
      type: 'PNG_DECODE_SUCCESS'
      reqId: number
      raster: DecodedRaster
    }
  | {
      type: 'PNG_DECODE_ERROR'
      reqId: number
      error: string
    }

self.onmessage = (e: MessageEvent<PngDecoderInMessage>) => {
  const { reqId, buffer, format } = e.data
  try {
    const raster = decodeRawGeoPngBuffer(buffer, format)
    // Transfer output Float32Array buffer back with zero-copy
    ;(self as any).postMessage(
      {
        type: 'PNG_DECODE_SUCCESS',
        reqId,
        raster,
      } as PngDecoderOutMessage,
      [raster.data.buffer]
    )
  } catch (err) {
    self.postMessage({
      type: 'PNG_DECODE_ERROR',
      reqId,
      error: err instanceof Error ? err.message : String(err),
    } as PngDecoderOutMessage)
  }
}
