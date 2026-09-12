import React, { useState } from 'react'
import {
  MapModeItem,
  HeightmapConfig,
  CircleOverlayConfig,
  ProjectionType,
} from '@/lib/geopng/types'
import { CountryFeature } from '@/lib/geopng/polygonBinning'
import { Icon } from '@/components/ui/icon'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { Window } from '@/components/ui/Window'
import { INFO_PANEL_CONFIG, MAPMODES_CONFIG } from '@config'

interface InfoFlyoutPanelProps {
  isOpen: boolean
  onClose: () => void
  isPinned?: boolean
  defaultPinned?: boolean
  onTogglePin?: (pinned: boolean) => void
  mapModes: MapModeItem[]
  heightmapConfig: HeightmapConfig
  circleOverlayConfig: CircleOverlayConfig
  selectedCountries: CountryFeature[]
  projection: ProjectionType
  cameraTilt?: number
  width?: number
  className?: string
}

export const InfoFlyoutPanel: React.FC<InfoFlyoutPanelProps> = ({
  isOpen,
  onClose,
  isPinned,
  defaultPinned = true,
  onTogglePin,
  mapModes,
  heightmapConfig,
  circleOverlayConfig,
  selectedCountries,
  projection,
  cameraTilt = 0,
  width = 336,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<string>(
    INFO_PANEL_CONFIG.defaultTab || INFO_PANEL_CONFIG.tabs[0]?.id || 'controls'
  )

  if (!isOpen) return null

  const activeModes = mapModes.filter((m) => m.active)

  return (
    <Window
      id="info-and-controls"
      title={INFO_PANEL_CONFIG.title || 'Information & Controls'}
      icon="info"
      isOpen={isOpen}
      onClose={onClose}
      isPinned={isPinned}
      defaultPinned={defaultPinned}
      onTogglePin={onTogglePin}
      defaultWidth={width}
      className={className}
    >
      {/* Tabs Container */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 min-h-0 overflow-hidden"
      >
        <TabsList className="w-full flex h-8 bg-muted/60 border border-border rounded-none p-0.5 shrink-0">
          {INFO_PANEL_CONFIG.tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex-1 text-[var(--body-font-size)] h-full flex items-center justify-center gap-1.5 rounded-none font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold transition-colors cursor-pointer truncate"
            >
              {tab.icon && <Icon name={tab.icon} size={14} className="shrink-0 text-white" />}
              <span className="truncate">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab Contents Scroll Area with Prominent Vertical Scrollbar */}
        <div className="flex-1 min-h-0 overflow-y-auto mt-3 pr-2 space-y-3 custom-scrollbar">
          {INFO_PANEL_CONFIG.tabs.map((tab) => (
            <TabsContent
              key={tab.id}
              value={tab.id}
              className="m-0 focus-visible:outline-none space-y-3"
            >
              {tab.type === 'controls' ? (
                /* ========================================================================= */
                /* TAB 1: CONTROLS & ACTIVE MODES (Built-in Dynamic View)                     */
                /* ========================================================================= */
                <div className="space-y-3">
                  {/* Live Active Modes Section */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground text-[var(--body-font-size)] uppercase tracking-wider flex items-center gap-1.5">
                        <Icon name="layers" size={14} className="text-white" />
                        <span>Active Rendering Modes</span>
                      </span>
                      <span className="text-[var(--body-font-size)] px-2 py-0.5 bg-primary/20 text-primary border border-primary/40 font-semibold leading-none flex items-center">
                        {activeModes.length} Active
                      </span>
                    </div>

                    <div className="space-y-1.5 bg-background/60 p-2 border border-border">
                      {activeModes.length === 0 ? (
                        <p className="text-muted-foreground text-[var(--body-font-size)] italic">
                          No active mapmodes. Base 2D raster only.
                        </p>
                      ) : (
                        activeModes.map((m) => {
                          const configItem = MAPMODES_CONFIG.modes.find((c) => c.id === m.id)
                          let desc =
                            configItem?.controlDescription ||
                            configItem?.description ||
                            'Active layer'

                          if (m.id === 'country_analysis') {
                            const count = selectedCountries.length
                            desc =
                              count > 0
                                ? `${count} ${count === 1 ? 'country' : 'countries'} isolated`
                                : configItem?.controlDescription || 'Active (select country)'
                          } else if (m.id === 'spike_map') {
                            const pctStr = heightmapConfig.opacityByPercentile ? ' (pct opacity)' : ''
                            const resStr = heightmapConfig.resolutionArcmin ? ` • ${heightmapConfig.resolutionArcmin}' res` : ''
                            const modeStr =
                              heightmapConfig.heightScaleMode === 'percentile'
                                ? ' • % height'
                                : heightmapConfig.heightScaleMode === 'blend'
                                  ? ` • blend (${Math.round((heightmapConfig.blendWeight ?? 0.5) * 100)}%)`
                                  : ' • linear height'
                            desc = `${Math.round(
                              (heightmapConfig.elevationScale ?? 800000) / 1000
                            )}km peak • ${Math.round((heightmapConfig.opacity ?? 0.9) * 100)}% opacity${pctStr}${modeStr}${resStr}`
                          } else if (m.id === 'circle_sizing') {
                            desc = `≥P${circleOverlayConfig.percentileCutoff ?? 99} cutoff • ${(
                              circleOverlayConfig.baseRadius ?? 1.0
                            ).toFixed(1)} ha/unit`
                          }

                          return (
                            <div
                              key={m.id}
                              className="flex items-center justify-between gap-2 text-[var(--body-font-size)] leading-snug"
                            >
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="w-1.5 h-1.5 bg-primary rounded-none" />
                                <span className="font-semibold text-foreground">{m.label}:</span>
                              </div>
                              <span className="text-muted-foreground text-right text-[var(--body-font-size)]">
                                {desc}
                              </span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* Camera & Projection State */}
                  <div className="flex items-center justify-between p-2 bg-background/40 border border-border text-[var(--body-font-size)]">
                    <span className="text-muted-foreground">Projection: <strong className="text-foreground">{projection}</strong></span>
                    <span className="text-muted-foreground">3D Tilt: <strong className="text-foreground">{Math.round(cameraTilt)}°</strong></span>
                  </div>

                  {/* Navigation Shortcuts Section */}
                  <div className="space-y-1.5">
                    <span className="font-bold text-foreground text-[var(--body-font-size)] uppercase tracking-wider block">
                      {tab.shortcutsHeader || 'Navigation Shortcuts'}
                    </span>

                    <div className="space-y-1 bg-background/60 p-2 border border-border">
                      {(tab.shortcuts || []).map((sc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 py-1.5 border-b border-border/40 last:border-0 text-[var(--body-font-size)]"
                        >
                          <kbd className="inline-flex items-center justify-center px-2 py-0.5 bg-muted text-foreground border border-border text-[var(--body-font-size)] font-mono font-semibold shadow-sm shrink-0 leading-normal">
                            {sc.key}
                          </kbd>
                          <span className="text-muted-foreground text-right text-[var(--body-font-size)] leading-normal">
                            {sc.action}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* ========================================================================= */
                /* TAB 2+: CUSTOM CONTENT (About, Policy, or any JSON5 tab)                  */
                /* ========================================================================= */
                <div className="space-y-3 text-[var(--body-font-size)]">
                  {(() => {
                    const data = tab.markdown || tab.content
                    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
                      return (
                        <div className="space-y-2">
                          {(data as any[]).map((sec, idx) => (
                            <details
                              key={idx}
                              open={sec.defaultOpen !== false}
                              className="group border border-border bg-background/60 rounded-none transition-colors"
                            >
                              <summary className="cursor-pointer font-bold text-foreground text-[var(--body-font-size)] p-2 flex items-center justify-between hover:bg-muted/40 transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
                                <span className="flex items-center gap-2">
                                  <Icon
                                    name="chevron_right"
                                    className="transition-transform duration-200 group-open:rotate-90 text-primary shrink-0"
                                  />
                                  <span>{sec.title || sec.heading || sec.summary}</span>
                                </span>
                              </summary>
                              <div className="p-2.5 pt-1 border-t border-border/40 text-[var(--body-font-size)]">
                                <MarkdownRenderer content={sec.content || sec.text} />
                              </div>
                            </details>
                          ))}
                        </div>
                      )
                    } else if (data) {
                      return (
                        <div className="p-3 bg-background/60 border border-border">
                          <MarkdownRenderer content={data as any} />
                        </div>
                      )
                    } else if (tab.sections && tab.sections.length > 0) {
                      return (
                        <div className="space-y-2">
                          {tab.title && (
                            <div className="font-bold text-foreground text-[var(--header-font-size)] mb-2">
                              {tab.title}
                            </div>
                          )}
                          {tab.sections.map((sec, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 bg-background/60 border border-border space-y-1"
                            >
                              <h3 className="font-bold text-foreground text-[var(--body-font-size)]">
                                {sec.heading}
                              </h3>
                              <p className="text-muted-foreground font-light leading-relaxed text-[var(--body-font-size)]">
                                {sec.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              )}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </Window>
  )
}

export default InfoFlyoutPanel
