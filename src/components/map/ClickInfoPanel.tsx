import React from 'react'
import { InspectionData } from '@/lib/geopng/types'

interface ClickInfoPanelProps {
  info: InspectionData | null
  pos: { x: number; y: number } | null
}

export const ClickInfoPanel: React.FC<ClickInfoPanelProps> = ({ info, pos }) => {
  if (!info || !pos) return null

  const formattedVal =
    info.value !== null && Number.isFinite(info.value)
      ? info.value.toLocaleString(undefined, { maximumFractionDigits: 4 })
      : 'NA'

  return (
    <div
      className="absolute pointer-events-none z-50 rounded border border-border bg-popover/95 px-3 py-2 shadow-md font-sans text-xs text-popover-foreground transition-all duration-75"
      style={{
        left: `${pos.x + 14}px`,
        top: `${pos.y - 70}px`,
        minWidth: '200px',
      }}
    >
      <div className="font-bold text-white mb-1">
        X: {info.pixelX}, Y: {info.pixelY}
      </div>
      <div className="space-y-0.5 text-[11px]">
        <div>
          <span className="text-muted-foreground font-semibold">Value: </span>
          <span className="font-bold text-foreground">{formattedVal}</span>
        </div>
        <div>
          <span className="text-muted-foreground font-semibold">Latlng: </span>
          <span className="text-muted-foreground">
            {info.lat.toFixed(5)}, {info.lng.toFixed(5)}
          </span>
        </div>
        {info.countryName && (
          <div>
            <span className="text-muted-foreground font-semibold">Country: </span>
            <span className="font-semibold text-foreground text-primary">{info.countryName}</span>
          </div>
        )}
      </div>
    </div>
  )
}
