/**
 * KronosPredictorPage Component
 *
 * Kronos AI Predictor page following TICKET_077 layout specification.
 * Zones: A (Header), B (Sidebar), C (Content), D (Action Bar)
 *
 * @see TICKET_205 - Kronos Predictor Page Migration
 * @see TICKET_077 - Silverstream UI Component Library
 */

import React, { useCallback, useMemo } from 'react';
import { Settings, Play, Loader2, Zap, TrendingUp, CheckCircle, Shuffle } from 'lucide-react';
import { cn } from '../../lib/utils';

// UI Components
import {
  ModelSelector,
  SliderInputGroup,
  PresetButtonGroup,
  CollapsiblePanel,
  SignalFilterPanel,
  TimeRangeSelector,
  type PresetOption,
} from '../ui';

// Hooks
import {
  useKronosPredictor,
  KRONOS_MODELS,
} from '../../hooks/useKronosPredictor';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface KronosPredictorPageProps {
  onSettingsClick?: () => void;
  /** Page title from navigation */
  pageTitle?: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const MODEL_PRESETS: PresetOption[] = [
  { id: 'quick', label: 'Quick Preview', icon: <Zap className="w-5 h-5" />, description: 'Fast testing' },
  { id: 'standard', label: 'Standard', icon: <TrendingUp className="w-5 h-5" />, description: 'Daily use' },
  { id: 'precision', label: 'High Precision', icon: <CheckCircle className="w-5 h-5" />, description: 'Stable results' },
  { id: 'explore', label: 'Explore Mode', icon: <Shuffle className="w-5 h-5" />, description: 'More possibilities' },
];

// -----------------------------------------------------------------------------
// KronosPredictorPage Component
// -----------------------------------------------------------------------------

export const KronosPredictorPage: React.FC<KronosPredictorPageProps> = ({
  onSettingsClick,
  pageTitle,
}) => {
  const { state, actions, computed } = useKronosPredictor();

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    actions.setStrategyName(e.target.value);
  }, [actions]);

  const handleRunAnalysis = useCallback(async () => {
    await actions.runAnalysis();
  }, [actions]);

  // Build range text for lookback slider
  const lookbackRangeText = useMemo(() => {
    return `Range: 10 - ${computed.maxLookback} (limited by model context)`;
  }, [computed.maxLookback]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="h-full flex flex-col bg-color-terminal-bg text-color-terminal-text">
      {/* ================================================================== */}
      {/* Zone A: Page Header                                                */}
      {/* ================================================================== */}
      <div className="flex-shrink-0 h-12 px-6 flex items-center justify-between border-b border-color-terminal-border bg-color-terminal-surface">
        <h1 className="text-sm font-bold terminal-mono uppercase tracking-wider text-color-terminal-accent-gold">
          {pageTitle || 'Kronos AI Predictor'}
        </h1>
        <button
          onClick={onSettingsClick}
          className="p-2 text-color-terminal-text-muted hover:text-color-terminal-text hover:bg-white/5 rounded transition-all"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* ================================================================ */}
        {/* Zone B: Strategy Sidebar                                         */}
        {/* ================================================================ */}
        <div className="w-56 flex-shrink-0 border-r border-color-terminal-border bg-color-terminal-panel/30 p-4 overflow-y-auto">
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary">
              Current Strategy
            </label>
            <input
              type="text"
              value={state.strategyName}
              onChange={handleNameChange}
              placeholder="Strategy Name"
              className="w-full px-3 py-2 text-xs border rounded focus:outline-none"
              style={{
                backgroundColor: '#112240',
                borderColor: '#233554',
                color: '#e6f1ff',
              }}
            />
            {/* Status Indicator */}
            <div className="flex items-center gap-2 text-[10px]">
              <div
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  state.result ? 'bg-color-terminal-accent-teal' : 'bg-color-terminal-text-muted'
                )}
              />
              <span
                className={cn(
                  state.result ? 'text-color-terminal-accent-teal' : 'text-color-terminal-text-muted'
                )}
              >
                {state.result ? 'Completed' : 'Ready'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Content Area (Zone C + Zone D) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ============================================================== */}
          {/* Zone C: Variable Content Area                                   */}
          {/* ============================================================== */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Preset Configuration Buttons */}
            <PresetButtonGroup
              presets={MODEL_PRESETS}
              activePreset={computed.activePreset}
              onSelect={actions.applyPreset}
              variant="full"
            />

            {/* Two-Column Layout for Config Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Model & Prediction Config */}
              <div className="space-y-6">
                {/* Model Selection */}
                <div className="border border-color-terminal-border rounded-lg bg-color-terminal-surface p-4">
                  <ModelSelector
                    title="Model Selection"
                    models={KRONOS_MODELS}
                    selectedModel={state.selectedModel}
                    onSelect={actions.setSelectedModel}
                  />
                </div>

                {/* Prediction Configuration */}
                <div className="border border-color-terminal-border rounded-lg bg-color-terminal-surface p-4">
                  <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-color-terminal-accent-gold mb-4">
                    Prediction Configuration
                  </h3>
                  <div className="space-y-4">
                    <SliderInputGroup
                      label="Historical Data Points (Lookback)"
                      value={state.lookback}
                      onChange={actions.setLookback}
                      min={10}
                      max={computed.maxLookback}
                      step={10}
                      rangeText={lookbackRangeText}
                    />
                    <SliderInputGroup
                      label="Prediction Data Points (Pred Length)"
                      value={state.predLen}
                      onChange={actions.setPredLen}
                      min={1}
                      max={512}
                      step={1}
                      rangeText="Range: 1 - 512"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Advanced Settings & Time Range */}
              <div className="space-y-6">
                {/* Advanced Settings (Collapsible) */}
                <CollapsiblePanel
                  title="Advanced Settings"
                  defaultExpanded={false}
                >
                  <div className="space-y-4">
                    <SliderInputGroup
                      label="Temperature"
                      hint="Higher = more random"
                      value={state.temperature}
                      onChange={actions.setTemperature}
                      min={0.1}
                      max={2.0}
                      step={0.1}
                      decimals={1}
                    />
                    <SliderInputGroup
                      label="Top-P (Nucleus Sampling)"
                      value={state.topP}
                      onChange={actions.setTopP}
                      min={0.5}
                      max={1.0}
                      step={0.05}
                      decimals={2}
                    />
                    <SliderInputGroup
                      label="Top-K"
                      hint="0 = Disabled"
                      value={state.topK}
                      onChange={actions.setTopK}
                      min={0}
                      max={256}
                      step={1}
                    />
                    {/* Sample Count */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[13px] font-medium text-color-terminal-text">
                        Sample Count
                        <span className="text-xs text-color-terminal-text-muted ml-1">
                          (Higher = more stable)
                        </span>
                      </label>
                      <select
                        value={state.sampleCount}
                        onChange={(e) => actions.setSampleCount(Number(e.target.value))}
                        className={cn(
                          'w-full px-3 py-2',
                          'border border-color-terminal-border rounded',
                          'bg-color-terminal-surface text-color-terminal-text',
                          'text-[13px]',
                          'focus:outline-none focus:border-color-terminal-accent-teal',
                          'transition-colors duration-200'
                        )}
                      >
                        {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CollapsiblePanel>

                {/* Time Range Selection */}
                <div className="border border-color-terminal-border rounded-lg bg-color-terminal-surface p-4">
                  <TimeRangeSelector
                    mode={state.timeRangeMode}
                    customTime={state.customTime}
                    onModeChange={actions.setTimeRangeMode}
                    onTimeChange={actions.setCustomTime}
                  />
                </div>
              </div>
            </div>

            {/* Signal Filter Panel (Full Width) */}
            <SignalFilterPanel
              config={state.signalFilter}
              onChange={actions.setSignalFilter}
              sampleCount={state.sampleCount}
              defaultExpanded={true}
            />

            {/* Result Display */}
            {state.result && (
              <div className="border border-color-terminal-border rounded-lg bg-color-terminal-surface p-4">
                <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-color-terminal-accent-gold mb-4">
                  Prediction Result
                </h3>
                {state.result.prediction && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ResultCard
                      label="Direction"
                      value={state.result.prediction.direction.toUpperCase()}
                      variant={state.result.prediction.direction === 'buy' ? 'success' : state.result.prediction.direction === 'sell' ? 'danger' : 'neutral'}
                    />
                    <ResultCard
                      label="Confidence"
                      value={`${(state.result.prediction.confidence * 100).toFixed(1)}%`}
                    />
                    <ResultCard
                      label="Expected Return"
                      value={`${(state.result.prediction.expectedReturn * 100).toFixed(2)}%`}
                    />
                    <ResultCard
                      label="Magnitude"
                      value={`${(state.result.prediction.magnitude * 100).toFixed(2)}%`}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Error Display */}
            {state.error && (
              <div className="border border-red-500/30 rounded-lg bg-red-500/10 p-4">
                <p className="text-sm text-red-400">{state.error}</p>
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* Zone D: Action Bar                                              */}
          {/* ============================================================== */}
          <div className="flex-shrink-0 border-t border-color-terminal-border bg-color-terminal-surface/50 p-4">
            <button
              onClick={handleRunAnalysis}
              disabled={!computed.canSubmit}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider border rounded transition-all",
                !computed.canSubmit
                  ? "border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-muted cursor-not-allowed"
                  : "border-color-terminal-accent-gold bg-color-terminal-accent-gold/10 text-color-terminal-accent-gold hover:bg-color-terminal-accent-gold/20"
              )}
            >
              {state.isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running Analysis...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Kronos Analysis
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

interface ResultCardProps {
  label: string;
  value: string;
  variant?: 'success' | 'danger' | 'neutral';
}

const ResultCard: React.FC<ResultCardProps> = ({ label, value, variant = 'neutral' }) => (
  <div className="flex flex-col gap-1 p-3 bg-color-terminal-surface-50 rounded">
    <span className="text-[10px] uppercase tracking-wider text-color-terminal-text-muted">
      {label}
    </span>
    <span
      className={cn(
        'text-lg font-bold',
        variant === 'success' && 'text-green-400',
        variant === 'danger' && 'text-red-400',
        variant === 'neutral' && 'text-color-terminal-text'
      )}
    >
      {value}
    </span>
  </div>
);

export default KronosPredictorPage;
