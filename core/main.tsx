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
