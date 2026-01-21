/**
 * Algorithm Code Registry - Centralized Algorithm Code Management
 *
 * TICKET_168: Centralized Algorithm Code Registry
 *
 * Manages algorithm code templates for all strategy types:
 * - Analysis (strategy_type = 9)
 * - Precondition (strategy_type = 4)
 * - Execution (strategy_type = 0, 1, 2, 3)
 * - Postcondition (strategy_type = 6)
 *
 * Prevents the recurring issue where `code` field contains strategy names
 * instead of actual Python code.
 */

// =============================================================================
// Types
// =============================================================================

export interface AlgorithmCodeTemplate {
  strategyName: string;
  strategyType: number;
  code: string;
  description?: string;
}

export type StrategyPhase = 'analysis' | 'precondition' | 'execution' | 'postcondition';

// =============================================================================
// Code Templates - Analysis (strategy_type = 9)
// =============================================================================

const ANALYSIS_TEMPLATES: Record<string, string> = {
  FreqMarketState002: `ctx.indicators['sma_fast'] = Indicators.sma(ctx.close, 10)
        ctx.indicators['sma_slow'] = Indicators.sma(ctx.close, 30)
        ctx.indicators['atr'] = Indicators.atr(ctx.high, ctx.low, ctx.close, 14)`,

  FreqMarketState005: `ctx.indicators['ema_fast'] = Indicators.ema(ctx.close, 12)
        ctx.indicators['ema_slow'] = Indicators.ema(ctx.close, 26)
        ctx.indicators['rsi'] = Indicators.rsi(ctx.close, 14)
        upper, middle, lower = Indicators.bollinger_bands(ctx.close, 20, 2.0)
        ctx.indicators['bb_upper'] = upper
        ctx.indicators['bb_middle'] = middle
        ctx.indicators['bb_lower'] = lower`,
};

// =============================================================================
// Code Templates - Precondition (strategy_type = 4)
// =============================================================================

const PRECONDITION_TEMPLATES: Record<string, string> = {
  SignalTriggerEMA001: `ema_fast = ctx.indicators.get('ema_fast', Indicators.ema(ctx.close, 12))
        ema_slow = ctx.indicators.get('ema_slow', Indicators.ema(ctx.close, 26))
        # Pre-condition: Only generate signals when EMA trend is confirmed
        trend_confirmed = ema_fast > ema_slow
        if not np.any(trend_confirmed):
            ctx.signals = np.zeros(ctx.data_length)
            return PhaseResult(success=True)`,

  SignalTriggerEMA002: `ema_fast = ctx.indicators.get('ema_fast', Indicators.ema(ctx.close, 12))
        ema_slow = ctx.indicators.get('ema_slow', Indicators.ema(ctx.close, 26))
        # Pre-condition v002: Stricter trend confirmation
        trend_confirmed = (ema_fast > ema_slow) & (ctx.close > ema_fast)
        if not np.any(trend_confirmed):
            ctx.signals = np.zeros(ctx.data_length)
            return PhaseResult(success=True)`,

  SignalTriggerEMA003: `ema_fast = ctx.indicators.get('ema_fast', Indicators.ema(ctx.close, 12))
        ema_slow = ctx.indicators.get('ema_slow', Indicators.ema(ctx.close, 26))
        rsi = ctx.indicators.get('rsi', Indicators.rsi(ctx.close, 14))
        # Pre-condition v003: EMA trend + RSI filter
        trend_ok = ema_fast > ema_slow
        rsi_ok = (rsi > 30) & (rsi < 70)
        if not np.any(trend_ok & rsi_ok):
            ctx.signals = np.zeros(ctx.data_length)
            return PhaseResult(success=True)`,

  SignalTriggerEMA004: `# Pre-condition v004: Always block signals (for testing no-trade scenario)
        ctx.signals = np.zeros(ctx.data_length)
        return PhaseResult(success=True)`,

  MyStrategy5778: `ema = ctx.indicators.get('ema_fast', Indicators.ema(ctx.close, 12))
        # Custom precondition: Price above EMA
        if not np.any(ctx.close > ema):
            ctx.signals = np.zeros(ctx.data_length)
            return PhaseResult(success=True)`,
};

// =============================================================================
// Code Templates - Execution (strategy_type = 0, 1, 2, 3)
// =============================================================================

const EXECUTION_TEMPLATES: Record<string, string> = {
  FreqExecute002: `sma_fast = ctx.indicators.get('sma_fast', Indicators.sma(ctx.close, 10))
        sma_slow = ctx.indicators.get('sma_slow', Indicators.sma(ctx.close, 30))
        ctx.signals = np.where(sma_fast > sma_slow, 1, -1)`,

  FreqExecute005: `ema_fast = ctx.indicators.get('ema_fast', Indicators.ema(ctx.close, 12))
        ema_slow = ctx.indicators.get('ema_slow', Indicators.ema(ctx.close, 26))
        ctx.signals = np.where(ema_fast > ema_slow, 1, -1)`,

  EnsembleVotingStrategy017: `ema_fast = ctx.indicators.get('ema_fast', Indicators.ema(ctx.close, 12))
        ema_slow = ctx.indicators.get('ema_slow', Indicators.ema(ctx.close, 26))
        rsi = ctx.indicators.get('rsi', Indicators.rsi(ctx.close, 14))
        bb_upper = ctx.indicators.get('bb_upper', ctx.close)
        bb_lower = ctx.indicators.get('bb_lower', ctx.close)
        # Ensemble voting: EMA trend + RSI oversold/overbought + BB breakout
        ema_signal = np.where(ema_fast > ema_slow, 1, -1)
        rsi_signal = np.where(rsi < 30, 1, np.where(rsi > 70, -1, 0))
        bb_signal = np.where(ctx.close < bb_lower, 1, np.where(ctx.close > bb_upper, -1, 0))
        # Vote: majority wins (at least 2 of 3 agree)
        vote_sum = ema_signal + rsi_signal + bb_signal
        ctx.signals = np.where(vote_sum >= 2, 1, np.where(vote_sum <= -2, -1, 0))`,

  MyStrategy7015: `sma = ctx.indicators.get('sma_fast', Indicators.sma(ctx.close, 20))
        rsi = ctx.indicators.get('rsi', Indicators.rsi(ctx.close, 14))
        # Custom strategy: SMA trend + RSI momentum
        ctx.signals = np.where((ctx.close > sma) & (rsi > 50), 1, np.where((ctx.close < sma) & (rsi < 50), -1, 0))`,
};

// =============================================================================
// Code Templates - Postcondition (strategy_type = 6)
// =============================================================================

const POSTCONDITION_TEMPLATES: Record<string, string> = {
  FreqExit001Simple: `if ctx.position is not None:
                # Simple exit: sell on opposite signal
                if ctx.signals[i] == -1:
                    ctx.sell(ctx.close[i], ctx.position.quantity, "Signal exit", i)`,

  FreqExit005Simple: `if ctx.position is not None:
                rsi = ctx.indicators.get('rsi')
                bb_upper = ctx.indicators.get('bb_upper')
                ema_fast = ctx.indicators.get('ema_fast')
                ema_slow = ctx.indicators.get('ema_slow')
                # Exit conditions: RSI overbought OR price above BB upper OR EMA crossover down
                exit_signal = False
                if rsi is not None and rsi[i] > 70:
                    exit_signal = True
                elif bb_upper is not None and ctx.close[i] > bb_upper[i]:
                    exit_signal = True
                elif ema_fast is not None and ema_slow is not None and ema_fast[i] < ema_slow[i]:
                    exit_signal = True
                elif ctx.signals[i] == -1:
                    exit_signal = True
                if exit_signal:
                    ctx.sell(ctx.close[i], ctx.position.quantity, "Exit condition", i)`,
};

// =============================================================================
// Registry Class
// =============================================================================

class AlgorithmCodeRegistry {
  private templates: Map<string, AlgorithmCodeTemplate> = new Map();

  constructor() {
    this.registerAll();
  }

  /**
   * Register all built-in algorithm templates
   */
  private registerAll(): void {
    // Analysis (strategy_type = 9)
    Object.entries(ANALYSIS_TEMPLATES).forEach(([name, code]) => {
      this.register(name, 9, code);
    });

    // Precondition (strategy_type = 4)
    Object.entries(PRECONDITION_TEMPLATES).forEach(([name, code]) => {
      this.register(name, 4, code);
    });

    // Execution (strategy_type = 0)
    Object.entries(EXECUTION_TEMPLATES).forEach(([name, code]) => {
      this.register(name, 0, code);
    });

    // Postcondition (strategy_type = 6)
    Object.entries(POSTCONDITION_TEMPLATES).forEach(([name, code]) => {
      this.register(name, 6, code);
    });
  }

  /**
   * Register an algorithm code template
   */
  register(strategyName: string, strategyType: number, code: string, description?: string): void {
    this.templates.set(strategyName, {
      strategyName,
      strategyType,
      code,
      description,
    });
  }

  /**
   * Get code for a strategy by name
   * Returns null if not found in registry
   */
  getCode(strategyName: string): string | null {
    const template = this.templates.get(strategyName);
    return template?.code || null;
  }

  /**
   * Check if code is valid (not just the strategy name)
   */
  isValidCode(strategyName: string, code: string): boolean {
    // Code is invalid if it equals the strategy name (common bug pattern)
    if (code === strategyName) {
      return false;
    }
    // Code should contain Python-like syntax
    if (code.length < 10) {
      return false;
    }
    return true;
  }

  /**
   * Get valid code for an algorithm
   * If database code is invalid, returns registry code
   * If both are invalid, returns null (fallback to db code handled by caller)
   */
  getValidCode(strategyName: string, dbCode: string): string | null {
    // If database code is valid, use it
    if (this.isValidCode(strategyName, dbCode)) {
      return dbCode;
    }

    // Otherwise, try to get from registry
    const registryCode = this.getCode(strategyName);
    if (registryCode) {
      console.debug(
        `[AlgorithmCodeRegistry] Using registry code for "${strategyName}"`
      );
      return registryCode;
    }

    // No valid code in registry - this is expected for user-created algorithms
    // Caller will fallback to db code
    return null;
  }

  /**
   * Get all registered strategy names
   */
  getAllNames(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Get all templates for a specific strategy type
   */
  getByType(strategyType: number): AlgorithmCodeTemplate[] {
    return Array.from(this.templates.values()).filter((t) => t.strategyType === strategyType);
  }

  /**
   * Validate all algorithms and return issues
   */
  validate(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    this.templates.forEach((template) => {
      if (!this.isValidCode(template.strategyName, template.code)) {
        issues.push(`Invalid code for "${template.strategyName}": code equals name`);
      }
    });

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const algorithmCodeRegistry = new AlgorithmCodeRegistry();

// Export templates for seed script generation
export const CODE_TEMPLATES = {
  analysis: ANALYSIS_TEMPLATES,
  precondition: PRECONDITION_TEMPLATES,
  execution: EXECUTION_TEMPLATES,
  postcondition: POSTCONDITION_TEMPLATES,
};
