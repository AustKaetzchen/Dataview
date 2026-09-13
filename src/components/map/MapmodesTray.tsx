import React, { useState, useMemo } from 'react';
import {
  MapModeItem,
  MapModeId,
  HeightmapConfig,
  CircleOverlayConfig,
} from '@/lib/geopng/types';
import { CountryFeature, CountryStats } from '@/lib/geopng/polygonBinning';
import { Icon } from '@/components/ui/icon';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LOCALISATION_CONFIG } from '@config';
import { CountryModeSettings } from './mapmodes/CountryModeSettings';
import {
  SpikeMapSettings,
  SPIKE_RESOLUTION_OPTIONS,
  formatSpikeResolution,
  strengthToSliderPos,
  sliderPosToStrength,
} from './mapmodes/SpikeMapSettings';
import { CircleOverlaySettings } from './mapmodes/CircleOverlaySettings';

export {
  SPIKE_RESOLUTION_OPTIONS,
  formatSpikeResolution,
  strengthToSliderPos,
  sliderPosToStrength,
};

export interface MapmodesTrayProps {
  allCountries: CountryFeature[];
  cameraTilt?: number;
  circleOverlayConfig: CircleOverlayConfig;
  countriesMode: boolean;
  countryStats?: CountryStats | null;
  heightmapConfig: HeightmapConfig;
  isCalculatingStats?: boolean;
  mapModes: MapModeItem[];
  onClearCountries: () => void;
  onReorderMapModes: (newModes: MapModeItem[]) => void;
  onSetCameraTilt?: (tilt: number) => void;
  onToggleCountriesMode?: (enabled: boolean) => void;
  onToggleCountry: (country: CountryFeature) => void;
  onToggleMapMode: (id: MapModeId) => void;
  selectedCountries: CountryFeature[];
  setCircleOverlayConfig: React.Dispatch<React.SetStateAction<CircleOverlayConfig>>;
  setHeightmapConfig: React.Dispatch<React.SetStateAction<HeightmapConfig>>;
}

/**
 * MapmodesTray interactive UI tray for configuring layer stacks and mapmodes.
 *
 * @param {MapmodesTrayProps} arg0_props
 *
 * @returns {React.ReactElement}
 */
export const MapmodesTray: React.FC<MapmodesTrayProps> = function (arg0_props) {
  //Convert from parameters
  let props = arg0_props;
  let {
    allCountries: all_countries,
    cameraTilt: camera_tilt,
    circleOverlayConfig: circle_overlay_config,
    countriesMode: countries_mode,
    countryStats: country_stats,
    heightmapConfig: heightmap_config,
    isCalculatingStats: is_calculating_stats,
    mapModes: map_modes,
    onClearCountries: on_clear_countries,
    onReorderMapModes: on_reorder_map_modes,
    onSetCameraTilt: on_set_camera_tilt,
    onToggleCountriesMode: on_toggle_countries_mode,
    onToggleCountry: on_toggle_country,
    onToggleMapMode: on_toggle_map_mode,
    selectedCountries: selected_countries,
    setCircleOverlayConfig: set_circle_overlay_config,
    setHeightmapConfig: set_heightmap_config,
  } = props;

  //Declare local instance variables
  let expanded_mode: MapModeId | null;
  let filtered_map_modes: MapModeItem[];
  let mapmode_search: string;
  let set_expanded_mode: React.Dispatch<React.SetStateAction<MapModeId | null>>;
  let set_mapmode_search: React.Dispatch<React.SetStateAction<string>>;
  let toggle_expand: (arg0_id: MapModeId) => void;

  //Function body
  ;[expanded_mode, set_expanded_mode] = useState<MapModeId | null>(null);
  ;[mapmode_search, set_mapmode_search] = useState('');

  toggle_expand = function (arg0_id: MapModeId) {
    let id = arg0_id;
    set_expanded_mode((arg0_prev) => (arg0_prev === id ? null : id));
  };

  //Filter mapmodes based on search
  filtered_map_modes = useMemo(() => {
    let q = mapmode_search.toLowerCase().trim();
    if (!q)
      return map_modes;
    return map_modes.filter((arg0_mode) => arg0_mode.label.toLowerCase().includes(q));
  }, [map_modes, mapmode_search]);

  //Return statement
  return (
    <TooltipProvider delayDuration={150}>
      <div className="absolute bottom-[var(--padding)] right-[var(--padding)] z-20 w-80 max-h-[calc(100vh-140px)] flex flex-col bg-card/98 backdrop-blur-md border border-border shadow-2xl p-[var(--padding)] space-y-[var(--padding)] text-[var(--body-font-size)] select-none font-sans overflow-hidden">
        {/* Tray Header */}
        <div className="flex items-center justify-between border-b border-border pb-[var(--cell-padding)] shrink-0">
          <span className="font-bold text-foreground text-[var(--header-font-size)] flex items-center gap-2">
            <Icon name="layers" />
            <span>{LOCALISATION_CONFIG.mapmodes.title}</span>
          </span>
          <span className="text-[var(--body-font-size)] px-2 py-0.5 bg-muted text-muted-foreground border border-border font-medium">
            {map_modes.filter((arg0_mode) => arg0_mode.active).length} {LOCALISATION_CONFIG.mapmodes.activeSuffix}
          </span>
        </div>

        {/* Mapmodes Searchbar */}
        <div className="relative shrink-0">
          <Icon
            name="search"
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="text"
            value={mapmode_search}
            onChange={(arg0_e) => set_mapmode_search(arg0_e.target.value)}
            placeholder={LOCALISATION_CONFIG.mapmodes.searchPlaceholder}
            className="w-full pl-7 pr-7 py-1 text-[var(--body-font-size)] bg-background/70 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary rounded-none"
          />
          {mapmode_search && (
            <button
              type="button"
              onClick={() => set_mapmode_search('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--body-font-size)] text-muted-foreground hover:text-foreground cursor-pointer px-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Composable Mode Items Stack */}
        <div className="space-y-1 overflow-y-auto max-h-[50vh] pr-0.5">
          {filtered_map_modes.length === 0 && (
            <p className="text-[var(--body-font-size)] text-muted-foreground italic py-2 text-center">
              {LOCALISATION_CONFIG.mapmodes.noResults}
            </p>
          )}
          {filtered_map_modes.map((arg0_mode) => {
            let mode = arg0_mode;
            let has_settings = mode.id !== 'default';
            let index = map_modes.findIndex((arg0_m) => arg0_m.id === mode.id);
            let is_expanded = expanded_mode === mode.id;

            return (
              <div key={mode.id} className="border border-border/80 bg-background/50">
                {/* Row Header */}
                <div
                  className={`flex items-center justify-between px-[var(--padding)] py-1.5 transition-colors ${
                    mode.active
                      ? 'bg-muted/60 text-foreground'
                      : 'bg-background/40 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={mode.active}
                      onChange={() => on_toggle_map_mode(mode.id)}
                      className="w-[var(--body-font-size)] h-[var(--body-font-size)] rounded-none accent-emerald-500 cursor-pointer shrink-0"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (has_settings)
                          toggle_expand(mode.id);
                      }}
                      className="truncate text-[var(--body-font-size)] text-left cursor-pointer flex-1 flex items-center gap-1.5 hover:text-foreground"
                    >
                      <span className={mode.active ? 'font-bold text-foreground' : 'font-light'}>
                        {mode.label}
                      </span>
                      {mode.id === 'country_analysis' && selected_countries.length > 0 && (
                        <span className="text-[var(--body-font-size)] px-1.5 py-0.2 bg-muted text-muted-foreground border border-border font-medium shrink-0">
                          {selected_countries.length}
                        </span>
                      )}
                      {mode.id === 'spike_map' && mode.active && (
                        <span className="text-[var(--body-font-size)] px-1.5 py-0.2 bg-muted text-muted-foreground border border-border font-medium shrink-0">
                          {heightmap_config.opacityByPercentile ? '3D • %' : '3D'}
                        </span>
                      )}
                      {mode.id === 'circle_sizing' && mode.active && (
                        <span className="text-[var(--body-font-size)] px-1.5 py-0.2 bg-muted text-muted-foreground border border-border font-medium shrink-0">
                          P{circle_overlay_config.percentileCutoff}
                        </span>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {has_settings && (
                      <button
                        type="button"
                        onClick={() => toggle_expand(mode.id)}
                        className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Toggle Settings"
                      >
                        <Icon name={is_expanded ? 'expand_less' : 'tune'} />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => {
                        if (index > 0) {
                          let temp = map_modes[index];
                          let updated = [...map_modes];
                          updated[index] = updated[index - 1];
                          updated[index - 1] = temp;
                          on_reorder_map_modes(updated);
                        }
                      }}
                      className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <Icon name="arrow_upward" />
                    </button>
                    <button
                      type="button"
                      disabled={index === map_modes.length - 1}
                      onClick={() => {
                        if (index < map_modes.length - 1) {
                          let temp = map_modes[index];
                          let updated = [...map_modes];
                          updated[index] = updated[index + 1];
                          updated[index + 1] = temp;
                          on_reorder_map_modes(updated);
                        }
                      }}
                      className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <Icon name="arrow_downward" />
                    </button>
                  </div>
                </div>

                {/* Subpanel settings */}
                {is_expanded && mode.id === 'country_analysis' && (
                  <CountryModeSettings
                    allCountries={all_countries}
                    countriesMode={countries_mode}
                    countryStats={country_stats}
                    isCalculatingStats={is_calculating_stats}
                    onClearCountries={on_clear_countries}
                    onToggleCountriesMode={on_toggle_countries_mode}
                    onToggleCountry={on_toggle_country}
                    selectedCountries={selected_countries}
                  />
                )}

                {is_expanded && mode.id === 'spike_map' && (
                  <SpikeMapSettings
                    cameraTilt={camera_tilt}
                    heightmapConfig={heightmap_config}
                    onSetCameraTilt={on_set_camera_tilt}
                    setHeightmapConfig={set_heightmap_config}
                  />
                )}

                {is_expanded && mode.id === 'circle_sizing' && (
                  <CircleOverlaySettings
                    circleOverlayConfig={circle_overlay_config}
                    setCircleOverlayConfig={set_circle_overlay_config}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Tray Footer */}
        <div className="pt-[var(--cell-padding)] border-t border-border/80 text-[var(--body-font-size)] text-muted-foreground flex flex-col gap-0.5 shrink-0">
          <span>{LOCALISATION_CONFIG.mapmodes.hintConfigure}</span>
          <span>{LOCALISATION_CONFIG.mapmodes.hintReorder}</span>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default MapmodesTray;
