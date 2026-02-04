"""
Combinator - Signal Combination

TICKET_250_5: Combinator Implementation

Combines multiple signals using various strategies.
"""

import numpy as np
from typing import Dict, Any, Optional


class Combinator:
    """
    Combines multiple signals into a single trading signal.

    Supports multiple combination strategies:
    - equal_weight: Simple average
    - voting: Majority vote
    - sharpe_weighted: Weight by historical Sharpe ratio
    - correlation_adjusted: Penalize correlated signals
    """

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize combinator.

        Args:
            config: Configuration dictionary containing:
                - method: Combination method
                - params: Method-specific parameters
        """
        self.method = config.get("method", "equal_weight")
        self.params = config.get("params", {})

        # Strategy dispatch
        self._strategies = {
            "equal_weight": self._equal_weight,
            "voting": self._voting,
            "sharpe_weighted": self._sharpe_weighted,
            "correlation_adjusted": self._correlation_adjusted,
        }

        if self.method not in self._strategies:
            raise ValueError(f"Unknown combination method: {self.method}")

    def combine(self, signals: np.ndarray) -> np.ndarray:
        """
        Combine multiple signals.

        Args:
            signals: Array of shape (N, M) where N is bars and M is sources

        Returns:
            combined: Combined signal array of shape (N,)
        """
        if signals.size == 0:
            return np.array([])

        if signals.ndim == 1:
            # Single signal source
            return signals

        strategy = self._strategies[self.method]
        return strategy(signals)

    def _equal_weight(self, signals: np.ndarray) -> np.ndarray:
        """
        Equal weight combination (simple average).

        All signals contribute equally to the final signal.
        """
        return np.nanmean(signals, axis=1)

    def _voting(self, signals: np.ndarray) -> np.ndarray:
        """
        Voting combination (majority vote).

        Counts bullish vs bearish signals.
        """
        threshold = self.params.get("threshold", 0.0)

        # Convert to votes: +1 (bullish), -1 (bearish), 0 (neutral)
        votes = np.zeros_like(signals)
        votes[signals > threshold] = 1
        votes[signals < -threshold] = -1

        # Sum votes and normalize
        vote_sum = np.sum(votes, axis=1)
        n_sources = signals.shape[1]

        return vote_sum / n_sources

    def _sharpe_weighted(self, signals: np.ndarray) -> np.ndarray:
        """
        Sharpe-weighted combination.

        Weights signals by their historical Sharpe ratio.
        Requires returns data for weight calculation.
        """
        lookback = self.params.get("lookback", 20)
        n_bars, n_sources = signals.shape

        # Calculate rolling Sharpe for each signal
        weights = np.ones(n_sources)

        if n_bars > lookback:
            # Use signal returns as proxy
            signal_returns = np.diff(signals, axis=0)

            for i in range(n_sources):
                returns = signal_returns[-lookback:, i]
                mean_ret = np.nanmean(returns)
                std_ret = np.nanstd(returns)

                if std_ret > 1e-8:
                    weights[i] = max(0, mean_ret / std_ret)
                else:
                    weights[i] = 0

        # Normalize weights
        total = np.sum(weights)
        if total > 1e-8:
            weights /= total
        else:
            weights = np.ones(n_sources) / n_sources

        # Apply weights
        return np.sum(signals * weights, axis=1)

    def _correlation_adjusted(self, signals: np.ndarray) -> np.ndarray:
        """
        Correlation-adjusted combination.

        Penalizes highly correlated signals to reduce redundancy.
        """
        lookback = self.params.get("lookback", 50)
        n_bars, n_sources = signals.shape

        if n_bars < lookback or n_sources < 2:
            return self._equal_weight(signals)

        # Calculate correlation matrix
        recent_signals = signals[-lookback:, :]
        corr_matrix = np.corrcoef(recent_signals.T)

        # Handle NaN in correlation
        corr_matrix = np.nan_to_num(corr_matrix, nan=0.0)

        # Calculate average correlation for each signal
        avg_corr = np.mean(np.abs(corr_matrix), axis=1)

        # Weight inversely to correlation (penalize high correlation)
        weights = 1.0 / (1.0 + avg_corr)

        # Normalize weights
        weights /= np.sum(weights)

        # Apply weights
        return np.sum(signals * weights, axis=1)
