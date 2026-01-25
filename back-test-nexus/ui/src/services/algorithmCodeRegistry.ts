/**
 * Algorithm Code Registry - Centralized Algorithm Code Management
 *
 * TICKET_168: Centralized Algorithm Code Registry
 * TICKET_201: Updated to backtrader class format (nona_server compatible)
 *
 * Manages algorithm code templates for all strategy types:
 * - Analysis (strategy_type = 9) - MarketStateBase subclasses
 * - Precondition (strategy_type = 4) - PreConditionBase subclasses
 * - Execution (strategy_type = 0, 1, 2, 3) - bt.Strategy subclasses
 * - Postcondition (strategy_type = 6) - PostConditionBase subclasses
 *
 * All templates are complete backtrader class definitions compatible with
 * nona_server generated code and V3 Executor cerebro execution.
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
// MarketStateBase subclasses for market regime detection
// =============================================================================

const ANALYSIS_TEMPLATES: Record<string, string> = {
  FreqMarketState002: `import backtrader as bt
from typing import List
from framework import MarketStateBase, MarketState

class FreqMarketState002(MarketStateBase):
    '''
    Market state detection using SMA crossover and ATR volatility.
    Detects TREND when fast SMA > slow SMA, RANGE otherwise.
    '''
    params = (
        ('sma_fast_period', 10),
        ('sma_slow_period', 30),
        ('atr_period', 14),
        ('atr_threshold', 0.001),
    )

    def initialize_indicators(self):
        '''Initialize SMA and ATR indicators'''
        self.sma_fast = bt.indicators.SMA(self.data.close, period=self.p.sma_fast_period)
        self.sma_slow = bt.indicators.SMA(self.data.close, period=self.p.sma_slow_period)
        self.atr = bt.indicators.ATR(self.data, period=self.p.atr_period)

    def calculate_trend_strength(self) -> float:
        '''Calculate trend strength based on SMA separation'''
        if len(self.sma_fast) > 0 and len(self.sma_slow) > 0:
            diff = abs(self.sma_fast[0] - self.sma_slow[0])
            if self.sma_slow[0] != 0:
                return min(diff / self.sma_slow[0] * 10, 1.0)
        return 0.0

    def calculate_range_strength(self) -> float:
        '''Calculate range strength (inverse of trend)'''
        return 1.0 - self.calculate_trend_strength()

    def get_volatility_state(self) -> bool:
        '''Check if volatility is high based on ATR'''
        if len(self.atr) > 0:
            return self.atr[0] > self.p.atr_threshold
        return False

    def should_confirm_state_change(self) -> bool:
        '''Confirm state change after 3 bars'''
        return self._state_change_counter >= 3

    def get_base_warmup_period(self) -> int:
        '''Base warmup is slow SMA period'''
        return self.p.sma_slow_period

    def get_additional_warmup_periods(self) -> List[int]:
        '''Additional warmup for ATR'''
        return [self.p.atr_period]

    def is_trend_changing(self) -> bool:
        '''Detect trend change via SMA crossover'''
        if len(self.sma_fast) > 1 and len(self.sma_slow) > 1:
            prev_above = self.sma_fast[-1] > self.sma_slow[-1]
            curr_above = self.sma_fast[0] > self.sma_slow[0]
            return prev_above != curr_above
        return False

    def next(self):
        '''Process each bar for market state detection'''
        if len(self.sma_fast) > 0 and len(self.sma_slow) > 0:
            if self.sma_fast[0] > self.sma_slow[0]:
                self.set_market_state(MarketState.TRENDING_UP)
            else:
                self.set_market_state(MarketState.TRENDING_DOWN)
`,

  FreqMarketState005: `import backtrader as bt
from typing import List
from framework import MarketStateBase, MarketState

class FreqMarketState005(MarketStateBase):
    '''
    Advanced market state detection using EMA, RSI, and Bollinger Bands.
    Multi-indicator confirmation for regime detection.
    '''
    params = (
        ('ema_fast_period', 12),
        ('ema_slow_period', 26),
        ('rsi_period', 14),
        ('bb_period', 20),
        ('bb_dev', 2.0),
        ('rsi_overbought', 70),
        ('rsi_oversold', 30),
    )

    def initialize_indicators(self):
        '''Initialize EMA, RSI, and Bollinger Bands'''
        self.ema_fast = bt.indicators.EMA(self.data.close, period=self.p.ema_fast_period)
        self.ema_slow = bt.indicators.EMA(self.data.close, period=self.p.ema_slow_period)
        self.rsi = bt.indicators.RSI(self.data.close, period=self.p.rsi_period)
        self.bb = bt.indicators.BollingerBands(self.data.close, period=self.p.bb_period, devfactor=self.p.bb_dev)

    def calculate_trend_strength(self) -> float:
        '''Calculate trend strength based on EMA separation and RSI'''
        if len(self.ema_fast) > 0 and len(self.ema_slow) > 0:
            ema_diff = abs(self.ema_fast[0] - self.ema_slow[0])
            if self.ema_slow[0] != 0:
                ema_strength = min(ema_diff / self.ema_slow[0] * 10, 0.5)
            else:
                ema_strength = 0.0
            # RSI contribution
            if len(self.rsi) > 0:
                rsi_val = self.rsi[0]
                if rsi_val > self.p.rsi_overbought or rsi_val < self.p.rsi_oversold:
                    rsi_strength = 0.5
                else:
                    rsi_strength = abs(rsi_val - 50) / 50 * 0.3
            else:
                rsi_strength = 0.0
            return min(ema_strength + rsi_strength, 1.0)
        return 0.0

    def calculate_range_strength(self) -> float:
        '''Calculate range strength from Bollinger Band width'''
        if len(self.bb.top) > 0 and len(self.bb.bot) > 0:
            bb_width = self.bb.top[0] - self.bb.bot[0]
            if self.bb.mid[0] != 0:
                normalized_width = bb_width / self.bb.mid[0]
                # Narrow bands = ranging market
                if normalized_width < 0.02:
                    return 0.8
                elif normalized_width < 0.05:
                    return 0.5
        return 1.0 - self.calculate_trend_strength()

    def get_volatility_state(self) -> bool:
        '''Check volatility based on BB width'''
        if len(self.bb.top) > 0 and len(self.bb.bot) > 0:
            bb_width = self.bb.top[0] - self.bb.bot[0]
            if self.bb.mid[0] != 0:
                return (bb_width / self.bb.mid[0]) > 0.05
        return False

    def should_confirm_state_change(self) -> bool:
        '''Confirm state change after 2 bars'''
        return self._state_change_counter >= 2

    def get_base_warmup_period(self) -> int:
        '''Base warmup is slow EMA period'''
        return self.p.ema_slow_period

    def get_additional_warmup_periods(self) -> List[int]:
        '''Additional warmup periods'''
        return [self.p.rsi_period, self.p.bb_period]

    def is_trend_changing(self) -> bool:
        '''Detect trend change via EMA crossover'''
        if len(self.ema_fast) > 1 and len(self.ema_slow) > 1:
            prev_above = self.ema_fast[-1] > self.ema_slow[-1]
            curr_above = self.ema_fast[0] > self.ema_slow[0]
            return prev_above != curr_above
        return False

    def next(self):
        '''Process each bar for market state detection'''
        if len(self.ema_fast) > 0 and len(self.ema_slow) > 0:
            if self.ema_fast[0] > self.ema_slow[0]:
                if len(self.rsi) > 0 and self.rsi[0] > self.p.rsi_overbought:
                    self.set_market_state(MarketState.HIGH_VOLATILITY)
                else:
                    self.set_market_state(MarketState.TRENDING_UP)
            else:
                if len(self.rsi) > 0 and self.rsi[0] < self.p.rsi_oversold:
                    self.set_market_state(MarketState.HIGH_VOLATILITY)
                else:
                    self.set_market_state(MarketState.TRENDING_DOWN)
`,
};

// =============================================================================
// Code Templates - Execution (strategy_type = 0, 1, 2, 3)
// bt.Strategy subclasses for signal generation and trade execution
// =============================================================================

const EXECUTION_TEMPLATES: Record<string, string> = {
  FreqExecute002: `import backtrader as bt

class FreqExecute002(bt.Strategy):
    '''
    SMA crossover execution strategy.
    Buys when fast SMA crosses above slow SMA, sells on opposite.
    '''
    params = (
        ('sma_fast_period', 10),
        ('sma_slow_period', 30),
        ('stake', 100),
    )

    def __init__(self):
        self.sma_fast = bt.indicators.SMA(self.data.close, period=self.p.sma_fast_period)
        self.sma_slow = bt.indicators.SMA(self.data.close, period=self.p.sma_slow_period)
        self.crossover = bt.indicators.CrossOver(self.sma_fast, self.sma_slow)
        self.order = None

    def next(self):
        if self.order:
            return

        if not self.position:
            if self.crossover > 0:
                self.order = self.buy(size=self.p.stake)
        else:
            if self.crossover < 0:
                self.order = self.sell(size=self.p.stake)

    def notify_order(self, order):
        if order.status in [order.Completed, order.Canceled, order.Margin]:
            self.order = None
`,

  FreqExecute005: `import backtrader as bt

class FreqExecute005(bt.Strategy):
    '''
    EMA crossover execution strategy.
    Uses faster EMA periods for more responsive signals.
    '''
    params = (
        ('ema_fast_period', 12),
        ('ema_slow_period', 26),
        ('stake', 100),
    )

    def __init__(self):
        self.ema_fast = bt.indicators.EMA(self.data.close, period=self.p.ema_fast_period)
        self.ema_slow = bt.indicators.EMA(self.data.close, period=self.p.ema_slow_period)
        self.crossover = bt.indicators.CrossOver(self.ema_fast, self.ema_slow)
        self.order = None

    def next(self):
        if self.order:
            return

        if not self.position:
            if self.crossover > 0:
                self.order = self.buy(size=self.p.stake)
        else:
            if self.crossover < 0:
                self.order = self.sell(size=self.p.stake)

    def notify_order(self, order):
        if order.status in [order.Completed, order.Canceled, order.Margin]:
            self.order = None
`,

  EnsembleVotingStrategy017: `import backtrader as bt

class EnsembleVotingStrategy017(bt.Strategy):
    '''
    Ensemble voting strategy combining EMA, RSI, and Bollinger Bands.
    Generates signals when at least 2 of 3 indicators agree.
    '''
    params = (
        ('ema_fast_period', 12),
        ('ema_slow_period', 26),
        ('rsi_period', 14),
        ('rsi_overbought', 70),
        ('rsi_oversold', 30),
        ('bb_period', 20),
        ('bb_dev', 2.0),
        ('stake', 100),
    )

    def __init__(self):
        self.ema_fast = bt.indicators.EMA(self.data.close, period=self.p.ema_fast_period)
        self.ema_slow = bt.indicators.EMA(self.data.close, period=self.p.ema_slow_period)
        self.rsi = bt.indicators.RSI(self.data.close, period=self.p.rsi_period)
        self.bb = bt.indicators.BollingerBands(self.data.close, period=self.p.bb_period, devfactor=self.p.bb_dev)
        self.order = None

    def next(self):
        if self.order:
            return

        # EMA signal
        ema_signal = 1 if self.ema_fast[0] > self.ema_slow[0] else -1

        # RSI signal
        if self.rsi[0] < self.p.rsi_oversold:
            rsi_signal = 1
        elif self.rsi[0] > self.p.rsi_overbought:
            rsi_signal = -1
        else:
            rsi_signal = 0

        # Bollinger Band signal
        if self.data.close[0] < self.bb.bot[0]:
            bb_signal = 1
        elif self.data.close[0] > self.bb.top[0]:
            bb_signal = -1
        else:
            bb_signal = 0

        # Ensemble voting: majority wins
        vote_sum = ema_signal + rsi_signal + bb_signal

        if not self.position:
            if vote_sum >= 2:
                self.order = self.buy(size=self.p.stake)
        else:
            if vote_sum <= -2:
                self.order = self.sell(size=self.p.stake)

    def notify_order(self, order):
        if order.status in [order.Completed, order.Canceled, order.Margin]:
            self.order = None
`,

  MyStrategy7015: `import backtrader as bt

class MyStrategy7015(bt.Strategy):
    '''
    Custom SMA + RSI momentum strategy.
    Buys when price above SMA and RSI > 50, sells on opposite.
    '''
    params = (
        ('sma_period', 20),
        ('rsi_period', 14),
        ('stake', 100),
    )

    def __init__(self):
        self.sma = bt.indicators.SMA(self.data.close, period=self.p.sma_period)
        self.rsi = bt.indicators.RSI(self.data.close, period=self.p.rsi_period)
        self.order = None

    def next(self):
        if self.order:
            return

        if not self.position:
            if self.data.close[0] > self.sma[0] and self.rsi[0] > 50:
                self.order = self.buy(size=self.p.stake)
        else:
            if self.data.close[0] < self.sma[0] and self.rsi[0] < 50:
                self.order = self.sell(size=self.p.stake)

    def notify_order(self, order):
        if order.status in [order.Completed, order.Canceled, order.Margin]:
            self.order = None
`,
};

// =============================================================================
// Code Templates - Precondition (strategy_type = 4)
// Filter strategies that determine if trading conditions are met
// =============================================================================

const PRECONDITION_TEMPLATES: Record<string, string> = {
  SignalTriggerEMA001: `import backtrader as bt
from framework import PreConditionBase

class SignalTriggerEMA001(PreConditionBase):
    '''
    Pre-condition: Only allow trading when EMA trend is confirmed.
    Fast EMA must be above slow EMA.
    '''
    params = (
        ('ema_fast_period', 12),
        ('ema_slow_period', 26),
    )

    def initialize_indicators(self):
        self.ema_fast = bt.indicators.EMA(self.data.close, period=self.p.ema_fast_period)
        self.ema_slow = bt.indicators.EMA(self.data.close, period=self.p.ema_slow_period)

    def check_precondition(self) -> bool:
        '''Return True if trend is confirmed (fast EMA > slow EMA)'''
        if len(self.ema_fast) > 0 and len(self.ema_slow) > 0:
            return self.ema_fast[0] > self.ema_slow[0]
        return False

    def next(self):
        pass
`,

  SignalTriggerEMA002: `import backtrader as bt
from framework import PreConditionBase

class SignalTriggerEMA002(PreConditionBase):
    '''
    Stricter pre-condition: EMA trend + price above fast EMA.
    '''
    params = (
        ('ema_fast_period', 12),
        ('ema_slow_period', 26),
    )

    def initialize_indicators(self):
        self.ema_fast = bt.indicators.EMA(self.data.close, period=self.p.ema_fast_period)
        self.ema_slow = bt.indicators.EMA(self.data.close, period=self.p.ema_slow_period)

    def check_precondition(self) -> bool:
        '''Return True if trend confirmed AND price above fast EMA'''
        if len(self.ema_fast) > 0 and len(self.ema_slow) > 0:
            trend_ok = self.ema_fast[0] > self.ema_slow[0]
            price_ok = self.data.close[0] > self.ema_fast[0]
            return trend_ok and price_ok
        return False

    def next(self):
        pass
`,

  SignalTriggerEMA003: `import backtrader as bt
from framework import PreConditionBase

class SignalTriggerEMA003(PreConditionBase):
    '''
    Pre-condition with RSI filter: EMA trend + RSI in valid range.
    '''
    params = (
        ('ema_fast_period', 12),
        ('ema_slow_period', 26),
        ('rsi_period', 14),
        ('rsi_low', 30),
        ('rsi_high', 70),
    )

    def initialize_indicators(self):
        self.ema_fast = bt.indicators.EMA(self.data.close, period=self.p.ema_fast_period)
        self.ema_slow = bt.indicators.EMA(self.data.close, period=self.p.ema_slow_period)
        self.rsi = bt.indicators.RSI(self.data.close, period=self.p.rsi_period)

    def check_precondition(self) -> bool:
        '''Return True if EMA trend ok AND RSI in valid range'''
        if len(self.ema_fast) > 0 and len(self.ema_slow) > 0 and len(self.rsi) > 0:
            trend_ok = self.ema_fast[0] > self.ema_slow[0]
            rsi_ok = self.p.rsi_low < self.rsi[0] < self.p.rsi_high
            return trend_ok and rsi_ok
        return False

    def next(self):
        pass
`,

  SignalTriggerEMA004: `import backtrader as bt
from framework import PreConditionBase

class SignalTriggerEMA004(PreConditionBase):
    '''
    Test pre-condition: Always blocks signals (for no-trade testing).
    '''
    params = ()

    def initialize_indicators(self):
        pass

    def check_precondition(self) -> bool:
        '''Always return False to block all signals'''
        return False

    def next(self):
        pass
`,

  MyStrategy5778: `import backtrader as bt
from framework import PreConditionBase

class MyStrategy5778(PreConditionBase):
    '''
    Custom precondition: Price must be above EMA.
    '''
    params = (
        ('ema_period', 12),
    )

    def initialize_indicators(self):
        self.ema = bt.indicators.EMA(self.data.close, period=self.p.ema_period)

    def check_precondition(self) -> bool:
        '''Return True if price is above EMA'''
        if len(self.ema) > 0:
            return self.data.close[0] > self.ema[0]
        return False

    def next(self):
        pass
`,
};

// =============================================================================
// Code Templates - Postcondition (strategy_type = 6)
// Exit condition strategies
// =============================================================================

const POSTCONDITION_TEMPLATES: Record<string, string> = {
  FreqExit001Simple: `import backtrader as bt
from framework import PostConditionBase

class FreqExit001Simple(PostConditionBase):
    '''
    Simple exit: Close position on opposite signal (crossover down).
    '''
    params = (
        ('sma_fast_period', 10),
        ('sma_slow_period', 30),
    )

    def initialize_indicators(self):
        self.sma_fast = bt.indicators.SMA(self.data.close, period=self.p.sma_fast_period)
        self.sma_slow = bt.indicators.SMA(self.data.close, period=self.p.sma_slow_period)
        self.crossover = bt.indicators.CrossOver(self.sma_fast, self.sma_slow)

    def check_postcondition(self) -> bool:
        '''Return True if should exit (crossover down)'''
        if len(self.crossover) > 0:
            return self.crossover[0] < 0
        return False

    def next(self):
        pass
`,

  FreqExit005Simple: `import backtrader as bt
from framework import PostConditionBase

class FreqExit005Simple(PostConditionBase):
    '''
    Multi-condition exit: RSI overbought OR price above BB upper OR EMA crossdown.
    '''
    params = (
        ('ema_fast_period', 12),
        ('ema_slow_period', 26),
        ('rsi_period', 14),
        ('rsi_overbought', 70),
        ('bb_period', 20),
        ('bb_dev', 2.0),
    )

    def initialize_indicators(self):
        self.ema_fast = bt.indicators.EMA(self.data.close, period=self.p.ema_fast_period)
        self.ema_slow = bt.indicators.EMA(self.data.close, period=self.p.ema_slow_period)
        self.rsi = bt.indicators.RSI(self.data.close, period=self.p.rsi_period)
        self.bb = bt.indicators.BollingerBands(self.data.close, period=self.p.bb_period, devfactor=self.p.bb_dev)
        self.ema_crossover = bt.indicators.CrossOver(self.ema_fast, self.ema_slow)

    def check_postcondition(self) -> bool:
        '''Return True if any exit condition is met'''
        # RSI overbought
        if len(self.rsi) > 0 and self.rsi[0] > self.p.rsi_overbought:
            return True
        # Price above BB upper
        if len(self.bb.top) > 0 and self.data.close[0] > self.bb.top[0]:
            return True
        # EMA crossover down
        if len(self.ema_crossover) > 0 and self.ema_crossover[0] < 0:
            return True
        return False

    def next(self):
        pass
`,
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
   * Check if code is valid (must be a complete class definition)
   * TICKET_201: Updated validation for backtrader class format
   */
  isValidCode(strategyName: string, code: string): boolean {
    // Code is invalid if it equals the strategy name (common bug pattern)
    if (code === strategyName) {
      return false;
    }
    // Code should be reasonably long for a class definition
    if (code.length < 100) {
      return false;
    }
    // TICKET_201: Valid code must contain 'class' keyword for backtrader format
    if (!code.includes('class ')) {
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
    // If database code is valid (contains class definition), use it
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
        issues.push(`Invalid code for "${template.strategyName}": missing class definition`);
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
