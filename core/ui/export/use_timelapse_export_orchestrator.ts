import React, { useState, useRef, useCallback } from 'react'
import { StartTimelapseExportOptions } from './video_export_modal'
import { ParsedDataLayer } from '@server/layer_parser'
import { ProjectionType } from '@framework/geopng/types.ts'

export interface UseTimelapseExportOrchestratorParams {
  activeLayer: ParsedDataLayer | null
  activeLayerId: string | null
  activeVariableSelectors: Record<string, string | string[]>
  layers: Record<string, ParsedDataLayer>
  legendPosition: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  projection: ProjectionType
  setIsPlaying: (arg0_playing: boolean) => void
  setVideoExportOpen: (arg0_open: boolean) => void
}

export interface UseTimelapseExportOrchestratorResult {
  cancelTimelapseExport: () => void
  isTimelapseExporting: boolean
  startTimelapseExport: (arg0_options: StartTimelapseExportOptions) => Promise<void>
  timelapseExportPct: number
  timelapseExportResult: { filename: string; path: string; sizeBytes: number } | null
  timelapseExportStatus: string
}

/**
 * Custom hook to manage asynchronous server-side timelapse video export jobs and polling.
 *
 * @param {UseTimelapseExportOrchestratorParams} arg0_params
 *
 * @returns {UseTimelapseExportOrchestratorResult}
 */
export function useTimelapseExportOrchestrator (
  arg0_params: UseTimelapseExportOrchestratorParams
): UseTimelapseExportOrchestratorResult {
  //Convert from parameters
  let active_layer = arg0_params.activeLayer
  let active_layer_id = arg0_params.activeLayerId
  let active_variable_selectors = arg0_params.activeVariableSelectors
  let layers = arg0_params.layers
  let legend_position = arg0_params.legendPosition
  let projection = arg0_params.projection
  let set_is_playing = arg0_params.setIsPlaying
  let set_video_export_open = arg0_params.setVideoExportOpen

  //Declare local instance variables
  let abort_timelapse_export_ref = useRef<boolean>(false)
  let active_export_job_id_ref = useRef<string | null>(null)
  let cancel_timelapse_export: () => void
  let is_timelapse_exporting: boolean
  let set_is_timelapse_exporting: React.Dispatch<React.SetStateAction<boolean>>
  let set_timelapse_export_pct: React.Dispatch<React.SetStateAction<number>>
  let set_timelapse_export_result: React.Dispatch<React.SetStateAction<{ filename: string; path: string; sizeBytes: number } | null>>
  let set_timelapse_export_status: React.Dispatch<React.SetStateAction<string>>
  let start_timelapse_export: (arg0_options: StartTimelapseExportOptions) => Promise<void>
  let timelapse_export_pct: number
  let timelapse_export_result: { filename: string; path: string; sizeBytes: number } | null
  let timelapse_export_status: string

  //Function body
  ;[is_timelapse_exporting, set_is_timelapse_exporting] = useState<boolean>(false)
  ;[timelapse_export_pct, set_timelapse_export_pct] = useState<number>(0)
  ;[timelapse_export_status, set_timelapse_export_status] = useState<string>('')
  ;[timelapse_export_result, set_timelapse_export_result] = useState<{
    filename: string
    path: string
    sizeBytes: number
  } | null>(null)

  cancel_timelapse_export = useCallback(() => {
    abort_timelapse_export_ref.current = true
    if (active_export_job_id_ref.current) {
      fetch('/api/export/cancel', {
        body: JSON.stringify({ jobId: active_export_job_id_ref.current }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }).catch(() => {})
    }
  }, [])

  start_timelapse_export = useCallback(
    async function (arg0_options: StartTimelapseExportOptions) {
      //Convert from parameters
      let options = arg0_options

      //Declare local instance variables
      let chosen_layers: string[]
      let job_id: string
      let poll_interval: any
      let start_resp: Response

      //Guard clauses
      if (Object.keys(layers).length === 0 && !active_layer)
        return

      //Function body
      abort_timelapse_export_ref.current = false
      set_is_playing(false)
      set_video_export_open(false)
      set_is_timelapse_exporting(true)
      set_timelapse_export_pct(0)
      set_timelapse_export_status('Submitting timelapse render job to server...')
      set_timelapse_export_result(null)

      chosen_layers = (options.selectedLayers && options.selectedLayers.length > 0)
        ? options.selectedLayers
        : (active_layer_id ? [active_layer_id] : ['GDP_nominal_pc'])

      try {
        start_resp = await fetch('/api/export/start-render', {
          body: JSON.stringify({
            concurrency: options.concurrency,
            endYear: options.endYear,
            fps: options.fps || 30,
            height: options.height || 1080,
            keepFrames: options.keepFrames,
            keyframesOnly: options.keyframesOnly,
            legendPosition: options.legendPosition || legend_position,
            maxRamPerThreadMb: options.maxRamPerThreadMb,
            mode: options.mode,
            outputFilename: options.filename,
            projection: options.projection || projection,
            resumeFolder: options.resumeFolder,
            selectedLayers: chosen_layers,
            startYear: options.startYear,
            timestepStep: options.timestepStep,
            variableSelectors: active_variable_selectors,
            width: options.width || 1920,
            zoom: options.zoom,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        })

        if (!start_resp.ok) {
          let err_text = await start_resp.text()
          throw new Error(`Server returned error: ${err_text}`)
        }

        let job_data = await start_resp.json()
        job_id = job_data.jobId
        active_export_job_id_ref.current = job_id

        await new Promise<void>((arg0_resolve, arg0_reject) => {
          poll_interval = setInterval(async () => {
            if (abort_timelapse_export_ref.current) {
              clearInterval(poll_interval)
              await fetch('/api/export/cancel', {
                body: JSON.stringify({ jobId: job_id }),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
              }).catch(() => {})
              set_timelapse_export_status('Timelapse export cancelled by user.')
              set_is_timelapse_exporting(false)
              arg0_resolve()
              return
            }

            try {
              let status_resp = await fetch(`/api/export/status?jobId=${encodeURIComponent(job_id)}`)
              if (status_resp.ok) {
                let status_data = await status_resp.json()
                set_timelapse_export_pct(status_data.progressPct || 0)
                set_timelapse_export_status(status_data.message || 'Rendering timelapse on server...')

                if (status_data.status === 'complete') {
                  clearInterval(poll_interval)
                  set_timelapse_export_result({
                    filename: status_data.filename,
                    path: status_data.path,
                    sizeBytes: status_data.sizeBytes,
                  })
                  set_timelapse_export_status(`Saved to exports/${status_data.filename} (${(status_data.sizeBytes / (1024*1024)).toFixed(2)} MB)`)
                  set_is_timelapse_exporting(false)
                  arg0_resolve()
                } else if (status_data.status === 'error') {
                  clearInterval(poll_interval)
                  set_timelapse_export_status(`Export failed: ${status_data.error || 'Unknown error'}`)
                  set_is_timelapse_exporting(false)
                  arg0_reject(new Error(status_data.error || 'Server rendering error'))
                } else if (status_data.status === 'cancelled') {
                  clearInterval(poll_interval)
                  set_timelapse_export_status('Timelapse export cancelled.')
                  set_is_timelapse_exporting(false)
                  arg0_resolve()
                }
              }
            } catch (arg0_poll_err) {
              console.warn('[TimelapseExport] Status poll error:', arg0_poll_err)
            }
          }, 400)
        })
      } catch (arg0_err: any) {
        console.error('Timelapse video export failed:', arg0_err)
        set_timelapse_export_status(`Export failed: ${arg0_err?.message || 'Unknown error'}`)
        set_is_timelapse_exporting(false)
      }
    },
    [active_layer, active_layer_id, active_variable_selectors, layers, legend_position, projection, set_is_playing, set_video_export_open]
  )

  //Return statement
  return {
    cancelTimelapseExport: cancel_timelapse_export,
    isTimelapseExporting: is_timelapse_exporting,
    startTimelapseExport: start_timelapse_export,
    timelapseExportPct: timelapse_export_pct,
    timelapseExportResult: timelapse_export_result,
    timelapseExportStatus: timelapse_export_status,
  }
}
