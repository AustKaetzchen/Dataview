import { createRoot } from 'react-dom/client'
import { LocalisationProvider } from '@localisation'
import './index.css'
import App from './ui/app.tsx'

// Prevent heavy serialization wrappers from hijacking high-frequency console.timeStamp calls
if (typeof console !== 'undefined' && typeof console.timeStamp === 'function') {
  let native_time_stamp = console.timeStamp.bind(console)
  console.timeStamp = function () {
    try {
      native_time_stamp.apply(console, arguments as any)
    } catch {
      // Ignore
    }
  }
}

// Normalise CanvasRenderingContext2D.prototype.measureText for Firefox.
// In Firefox, actualBoundingBoxLeft is returned as a positive offset left from the baseline.
// deck.gl FontAtlasManager calculates glyph width as Math.ceil(metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft),
// which produces negative or near-zero widths in Firefox, blowing up text background billboard bounds.
if (typeof window !== 'undefined' && window.CanvasRenderingContext2D) {
  let native_measure_text = CanvasRenderingContext2D.prototype.measureText
  CanvasRenderingContext2D.prototype.measureText = function (arg0_text: string) {
    let metrics = native_measure_text.call(this, arg0_text)
    if (metrics && typeof metrics.actualBoundingBoxLeft === 'number' && metrics.actualBoundingBoxLeft > 0) {
      let measured_width = metrics.width || 0
      return new Proxy(metrics, {
        get (arg0_target, arg1_prop) {
          if (arg1_prop === 'actualBoundingBoxLeft')
            return 0
          if (arg1_prop === 'actualBoundingBoxRight')
            return measured_width
          return (arg0_target as any)[arg1_prop]
        },
      })
    }
    return metrics
  }
}

/**
 * Initialises and renders the root React application tree.
 */
{
  let root_element = document.getElementById('root')
  if (root_element) {
    let root = createRoot(root_element)
    root.render(
      <LocalisationProvider>
        <App />
      </LocalisationProvider>
    )
  }
}
