/**
 * View state and camera projection management hook for Deck.gl MapViewer.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { MapView, OrbitView } from '@deck.gl/core'
import { MAP_CONFIG } from '@common'
import type { HeightmapConfig, ProjectionType } from '@framework/geopng/types.ts'
import {
  SmoothGlobeController,
  SmoothGlobeView,
  SmoothMapController,
  SmoothOrbitController,
} from './smooth_controllers'

export interface MapViewStateOptions {
  heightmapConfig: HeightmapConfig
  projection: ProjectionType
}

export interface MapViewStateResult {
  cameraTilt: number
  effectiveViewState: any
  handleDoubleClick: () => void
  handleResetNorth: () => void
  handleResetView: () => void
  handleToggleTilt: () => void
  handleViewStateChange: (arg0_e: any) => void
  handleZoomIn: () => void
  handleZoomOut: () => void
  projViewStates: Record<ProjectionType, any>
  setProjViewStates: React.Dispatch<React.SetStateAction<Record<ProjectionType, any>>>
  views: any
}

/**
 * Manages reactive view states across Mercator, Globe, Equirectangular, and Equal Earth projections.
 *
 * @param {MapViewStateOptions} arg0_options
 *
 * @returns {MapViewStateResult}
 */
export function useMapViewState (arg0_options: MapViewStateOptions): MapViewStateResult {
  //Convert from parameters
  let heightmap_config = arg0_options.heightmapConfig
  let projection = arg0_options.projection

  //Declare local instance variables
  let camera_tilt: number
  let effective_view_state: any
  let handle_double_click: () => void
  let handle_reset_north: () => void
  let handle_toggle_tilt: () => void
  let handle_view_state_change: (arg0_e: any) => void
  let handle_zoom_in: () => void
  let handle_zoom_out: () => void
  let [proj_view_states, set_proj_view_states] = useState<Record<ProjectionType, any>>({
    EqualEarth: {
      maxRotationX: 0,
      maxZoom: 10,
      minRotationX: -85,
      minZoom: 0.2,
      rotationOrbit: 0,
      rotationX: 0,
      target: [0, 0, 0],
      zoom: typeof window !== 'undefined'
        ? Math.max(1.5, parseFloat(Math.log2((window.innerHeight*0.96)/180).toFixed(2)))
        : 2.80,
    },
    Equirectangular: {
      maxRotationX: 0,
      maxZoom: 10,
      minRotationX: -85,
      minZoom: 0.2,
      rotationOrbit: 0,
      rotationX: 0,
      target: [0, 0, 0],
      zoom: typeof window !== 'undefined'
        ? Math.max(1.5, parseFloat(Math.log2(window.innerWidth/360).toFixed(2)))
        : 2.83,
    },
    Globe: MAP_CONFIG.mapDefines?.initialGlobe || {
      bearing: 0,
      latitude: 20,
      longitude: 0,
      maxPitch: 85,
      maxZoom: 18,
      minPitch: 0,
      minZoom: 0,
      pitch: 0,
      zoom: 0,
    },
    Mercator: MAP_CONFIG.mapDefines?.initialMercator || {
      bearing: 0,
      latitude: 20,
      longitude: 0,
      maxPitch: 85,
      maxZoom: 18,
      minPitch: 0,
      minZoom: 0,
      pitch: 0,
      zoom: 1.2,
    },
  })
  let views: any

  //Function body
  useEffect(() => {
    if (heightmap_config.enabled) {
      set_proj_view_states((arg0_prev) => ({
        ...arg0_prev,
        EqualEarth: { ...arg0_prev.EqualEarth, rotationX: Math.min(-35, arg0_prev.EqualEarth?.rotationX || -45) },
        Equirectangular: { ...arg0_prev.Equirectangular, rotationX: Math.min(-35, arg0_prev.Equirectangular?.rotationX || -45) },
        Globe: { ...arg0_prev.Globe, bearing: 0, pitch: Math.max(35, arg0_prev.Globe?.pitch || 45) },
        Mercator: { ...arg0_prev.Mercator, pitch: Math.max(35, arg0_prev.Mercator?.pitch || 45) },
      }))
    }
  }, [heightmap_config.enabled, set_proj_view_states])

  useEffect(() => {
    let params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    let url_zoom = params?.get('zoom') ? parseFloat(params.get('zoom')!) : null
    if (url_zoom && !Number.isNaN(url_zoom)) {
      set_proj_view_states((arg0_prev) => ({
        ...arg0_prev,
        [projection]: {
          ...arg0_prev[projection],
          zoom: url_zoom,
        },
      }))
    }
    ;(window as any).__setMapZoom = (arg0_new_zoom: number) => {
      set_proj_view_states((arg0_prev) => ({
        ...arg0_prev,
        [projection]: {
          ...arg0_prev[projection],
          zoom: arg0_new_zoom,
        },
      }))
    }
    ;(window as any).__setMapCenter = (arg0_lng: number, arg0_lat: number, arg0_zoom?: number) => {
      set_proj_view_states((arg0_prev) => ({
        ...arg0_prev,
        [projection]: {
          ...arg0_prev[projection],
          latitude: arg0_lat,
          longitude: arg0_lng,
          target: [arg0_lng, arg0_lat, 0],
          zoom: (arg0_zoom !== undefined) ? arg0_zoom : arg0_prev[projection]?.zoom,
        },
      }))
    }
    return () => {
      delete (window as any).__setMapZoom
      delete (window as any).__setMapCenter
    }
  }, [projection, set_proj_view_states])

  handle_double_click = useCallback(() => {
    let equal_earth_zoom = typeof window !== 'undefined'
      ? Math.max(1.5, parseFloat(Math.log2((window.innerHeight*0.96)/180).toFixed(2)))
      : 2.80
    let equirect_zoom = typeof window !== 'undefined'
      ? Math.max(1.5, parseFloat(Math.log2(window.innerWidth/360).toFixed(2)))
      : 2.83

    set_proj_view_states((arg0_prev) => ({
      ...arg0_prev,
      [projection]:
        (projection === 'Equirectangular')
          ? { maxRotationX: 0, maxZoom: 10, minRotationX: -85, minZoom: 0.2, rotationOrbit: 0, rotationX: 0, target: [0, 0, 0], zoom: equirect_zoom }
          : (projection === 'EqualEarth')
            ? { maxRotationX: 0, maxZoom: 10, minRotationX: -85, minZoom: 0.2, rotationOrbit: 0, rotationX: 0, target: [0, 0, 0], zoom: equal_earth_zoom }
            : (projection === 'Globe')
              ? { bearing: 0, latitude: 20, longitude: 0, maxPitch: 85, maxZoom: 18, minPitch: 0, minZoom: 0, pitch: 0, zoom: 3 }
              : { bearing: 0, latitude: 20, longitude: 0, maxPitch: 85, maxZoom: 18, minPitch: 0, minZoom: 0, pitch: 0, zoom: 1.2 },
    }))
  }, [projection, set_proj_view_states])

  handle_reset_north = useCallback(() => {
    set_proj_view_states((arg0_prev) => {
      let current = arg0_prev[projection] || {}
      if (projection === 'Mercator' || projection === 'Globe') {
        return {
          ...arg0_prev,
          [projection]: {
            ...current,
            bearing: 0,
          },
        }
      }
      return {
        ...arg0_prev,
        [projection]: {
          ...current,
          rotationOrbit: 0,
        },
      }
    })
  }, [projection, set_proj_view_states])

  handle_toggle_tilt = useCallback(() => {
    set_proj_view_states((arg0_prev) => {
      let current = arg0_prev[projection] || {}
      if (projection === 'Mercator' || projection === 'Globe') {
        let is_tilted = (current.pitch || 0) > 10
        return {
          ...arg0_prev,
          [projection]: {
            ...current,
            pitch: is_tilted ? 0 : 45,
          },
        }
      }
      let is_tilted = Math.abs(current.rotationX || 0) > 10
      return {
        ...arg0_prev,
        [projection]: {
          ...current,
          rotationX: is_tilted ? 0 : -45,
        },
      }
    })
  }, [projection, set_proj_view_states])

  handle_view_state_change = useCallback(
    (arg0_e: any) => {
      //Convert from parameters
      let next_view_state = arg0_e.viewState

      //Function body
      if (projection === 'Globe') {
        let bearing = next_view_state.bearing ?? 0
        let clamped_lat = Math.max(-85, Math.min(85, next_view_state.latitude ?? 0))
        bearing = ((bearing + 180)%360 + 360)%360 - 180

        next_view_state = {
          ...next_view_state,
          bearing,
          latitude: clamped_lat,
        }
      }

      set_proj_view_states((arg0_prev) => ({
        ...arg0_prev,
        [projection]: next_view_state,
      }))
    },
    [projection, set_proj_view_states]
  )

  handle_zoom_in = useCallback(() => {
    set_proj_view_states((arg0_prev) => {
      let current = arg0_prev[projection] || {}
      let max_zoom = current.maxZoom ?? 18
      let new_zoom = Math.min(max_zoom, (current.zoom ?? 1) + 0.6)
      return {
        ...arg0_prev,
        [projection]: {
          ...current,
          zoom: new_zoom,
        },
      }
    })
  }, [projection, set_proj_view_states])

  handle_zoom_out = useCallback(() => {
    set_proj_view_states((arg0_prev) => {
      let current = arg0_prev[projection] || {}
      let min_zoom = current.minZoom ?? 0
      let new_zoom = Math.max(min_zoom, (current.zoom ?? 1) - 0.6)
      return {
        ...arg0_prev,
        [projection]: {
          ...current,
          zoom: new_zoom,
        },
      }
    })
  }, [projection, set_proj_view_states])

  views = useMemo(() => {
    if (projection === 'Globe') {
      return new SmoothGlobeView({
        controller: {
          doubleClickZoom: false,
          dragMode: 'pan',
          dragPan: true,
          dragRotate: true,
          inertia: true,
          touchRotate: true,
          touchZoom: true,
          type: SmoothGlobeController,
        },
        id: 'globe-view',
        parameters: { cullMode: 'none' },
        resolution: 1,
      })
    }
    if (projection === 'Equirectangular') {
      return new OrbitView({
        controller: {
          doubleClickZoom: false,
          dragMode: 'pan',
          dragPan: true,
          dragRotate: true,
          inertia: true,
          touchRotate: true,
          touchZoom: true,
          type: SmoothOrbitController,
        },
        id: 'equirectangular-view',
        orbitAxis: 'Y',
      })
    }
    if (projection === 'EqualEarth') {
      return new OrbitView({
        controller: {
          doubleClickZoom: false,
          dragMode: 'pan',
          dragPan: true,
          dragRotate: true,
          inertia: true,
          touchRotate: true,
          touchZoom: true,
          type: SmoothOrbitController,
        },
        id: 'equal-earth-view',
        orbitAxis: 'Y',
      })
    }
    return new MapView({
      controller: {
        doubleClickZoom: false,
        dragMode: 'pan',
        dragPan: true,
        dragRotate: true,
        inertia: true,
        touchRotate: true,
        touchZoom: true,
        type: SmoothMapController,
      },
      id: 'map-view',
      repeat: false,
    })
  }, [projection])

  camera_tilt = (projection === 'Mercator' || projection === 'Globe')
    ? proj_view_states[projection]?.pitch || 0
    : Math.abs(proj_view_states[projection]?.rotationX || 0)

  effective_view_state = proj_view_states[projection]

  //Return statement
  return {
    cameraTilt: camera_tilt,
    effectiveViewState: effective_view_state,
    handleDoubleClick: handle_double_click,
    handleResetNorth: handle_reset_north,
    handleResetView: handle_double_click,
    handleToggleTilt: handle_toggle_tilt,
    handleViewStateChange: handle_view_state_change,
    handleZoomIn: handle_zoom_in,
    handleZoomOut: handle_zoom_out,
    projViewStates: proj_view_states,
    setProjViewStates: set_proj_view_states,
    views,
  }
}
