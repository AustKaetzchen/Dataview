import { _GlobeView } from '@deck.gl/core'
import { SmoothGlobeViewport } from './SmoothGlobeViewport'

/**
 * SmoothGlobeView ensures deck.gl uses SmoothGlobeViewport for rendering and projection.
 */
export class SmoothGlobeView extends _GlobeView {
  /**
   * Returns custom viewport class.
   *
   * @returns {typeof SmoothGlobeViewport}
   */
  getViewportType () {
    //Return statement
    return SmoothGlobeViewport
  }
}

export default SmoothGlobeView
