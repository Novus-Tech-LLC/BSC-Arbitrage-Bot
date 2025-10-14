import asyncio
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import numpy as np
import logging

from dexscreener_api import TokenData

logger = logging.getLogger(__name__)

@dataclass
class TimeframeData:
    timeframe: str  # '1h', '4h', '12h', '24h', '3d'
    price_change: float
    volume_avg: float
    volume_trend: str  # 'increasing', 'stable', 'decreasing'
    price_momentum: str  # 'strong_bullish', 'bullish', 'neutral', 'bearish', 'strong_bearish'
    support_level: float
    resistance_level: float
    volatility: float
    
@dataclass
class MultiTimeframeAnalysis:
    token: TokenData
    timeframes: Dict[str, TimeframeData]
    overall_trend: str
    overall_score: float
    entry_timing: str  # 'immediate', 'wait_dip', 'wait_breakout', 'avoid'
    risk_reward_ratio: float
    confidence_level: float
    analysis_timestamp: datetime

class MultiTimeframeAnalyzer:
    def __init__(self):
        self.timeframe_weights = {
            '1h': 0.15,
            '4h': 0.25,
            '12h': 0.25,
            '24h': 0.20,
            '3d': 0.15
        }
        
    def calculate_price_momentum(self, price_change: float) -> str:
        """Categorize price momentum"""
        if price_change > 50:
            return 'strong_bullish'
        elif price_change > 20:
            return 'bullish'
        elif price_change > -10:
            return 'neutral'
        elif price_change > -30:
            return 'bearish'
        else:
            return 'strong_bearish'
            
    def calculate_volume_trend(self, volumes: List[float]) -> str:
        """Analyze volume trend over time"""
        if len(volumes) < 2:
            return 'stable'
            
        # Calculate trend
        avg_first_half = np.mean(volumes[:len(volumes)//2])
        avg_second_half = np.mean(volumes[len(volumes)//2:])
        
        ratio = avg_second_half / (avg_first_half + 1)
        
        if ratio > 1.3:
            return 'increasing'
        elif ratio < 0.7:
            return 'decreasing'
        else:
            return 'stable'
            
    def calculate_support_resistance(self, prices: List[float]) -> Tuple[float, float]:
        """Calculate support and resistance levels"""
        if not prices:
            return 0, 0
            
        # Simple method: use percentiles
        support = np.percentile(prices, 20)
        resistance = np.percentile(prices, 80)
        
        return support, resistance
        
    def calculate_volatility(self, prices: List[float]) -> float:
        """Calculate price volatility"""
        if len(prices) < 2:
            return 0
            
        returns = [(prices[i] - prices[i-1]) / prices[i-1] for i in range(1, len(prices))]
        return np.std(returns) * 100 if returns else 0
        
    def analyze_timeframe(self, token: TokenData, timeframe: str, 
                         historical_prices: List[float], 
                         historical_volumes: List[float]) -> TimeframeData:
        """Analyze a single timeframe"""
        
        # Calculate metrics
        if historical_prices:
            price_change = ((historical_prices[-1] - historical_prices[0]) / historical_prices[0]) * 100
        else:
            price_change = token.price_change_24h  # Fallback
            
        volume_avg = np.mean(historical_volumes) if historical_volumes else token.volume_24h
        volume_trend = self.calculate_volume_trend(historical_volumes)
        price_momentum = self.calculate_price_momentum(price_change)
        support, resistance = self.calculate_support_resistance(historical_prices)
        volatility = self.calculate_volatility(historical_prices)
        
        return TimeframeData(
            timeframe=timeframe,
            price_change=price_change,
            volume_avg=volume_avg,
            volume_trend=volume_trend,
            price_momentum=price_momentum,
            support_level=support,
            resistance_level=resistance,
            volatility=volatility
        )
        
    def calculate_overall_trend(self, timeframes: Dict[str, TimeframeData]) -> str:
        """Determine overall trend from all timeframes"""
        momentum_scores = {
            'strong_bullish': 2,
            'bullish': 1,
            'neutral': 0,
            'bearish': -1,
            'strong_bearish': -2
        }
        
        weighted_score = 0
        for tf, data in timeframes.items():
            weight = self.timeframe_weights[tf]
            score = momentum_scores[data.price_momentum]
            weighted_score += score * weight
            
        if weighted_score > 1.5:
            return 'strong_bullish'
        elif weighted_score > 0.5:
            return 'bullish'
        elif weighted_score > -0.5:
            return 'neutral'
        elif weighted_score > -1.5:
            return 'bearish'
        else:
            return 'strong_bearish'
            
    def calculate_entry_timing(self, token: TokenData, timeframes: Dict[str, TimeframeData], 
                              overall_trend: str) -> str:
        """Determine optimal entry timing"""
        
        # Check short-term momentum
        short_term = timeframes.get('1h')
        medium_term = timeframes.get('4h')
        
        if not short_term or not medium_term:
            return 'wait_dip'
            
        # If overall bullish but short-term overbought
        if overall_trend in ['bullish', 'strong_bullish']:
            if short_term.price_change > 30 and short_term.volatility > 10:
                return 'wait_dip'
            elif token.price_usd < short_term.support_level * 1.1:
                return 'immediate'
            elif token.price_usd > short_term.resistance_level * 0.95:
                return 'wait_breakout'
            else:
                return 'immediate'
        else:
            return 'avoid'
            
    def calculate_risk_reward(self, token: TokenData, timeframes: Dict[str, TimeframeData]) -> float:
        """Calculate risk/reward ratio"""
        # Get average support/resistance
        supports = [tf.support_level for tf in timeframes.values() if tf.support_level > 0]
        resistances = [tf.resistance_level for tf in timeframes.values() if tf.resistance_level > 0]
        
        if not supports or not resistances:
            return 1.0
            
        avg_support = np.mean(supports)
        avg_resistance = np.mean(resistances)
        
        # Calculate potential loss and gain
        potential_loss = abs(token.price_usd - avg_support)
        potential_gain = abs(avg_resistance - token.price_usd)
        
        if potential_loss == 0:
            return 3.0  # Max ratio
            
        return min(potential_gain / potential_loss, 3.0)
        
    def calculate_confidence_level(self, timeframes: Dict[str, TimeframeData], 
                                 overall_trend: str, risk_reward: float) -> float:
        """Calculate confidence level (0-100)"""
        confidence = 50  # Base confidence
        
        # Trend alignment bonus
        trend_alignment = sum(1 for tf in timeframes.values() 
                            if tf.price_momentum in ['bullish', 'strong_bullish'])
        confidence += trend_alignment * 5
        
        # Volume trend bonus
        volume_increasing = sum(1 for tf in timeframes.values() 
                              if tf.volume_trend == 'increasing')
        confidence += volume_increasing * 5
        
        # Risk/reward bonus
        if risk_reward > 2:
            confidence += 15
        elif risk_reward > 1.5:
            confidence += 10
        elif risk_reward > 1:
            confidence += 5
            
        # Volatility penalty
        avg_volatility = np.mean([tf.volatility for tf in timeframes.values()])
        if avg_volatility > 20:
            confidence -= 10
        elif avg_volatility > 15:
            confidence -= 5
            
        return min(max(confidence, 0), 100)
        
    def calculate_overall_score(self, token: TokenData, timeframes: Dict[str, TimeframeData],
                              overall_trend: str, risk_reward: float, confidence: float) -> float:
        """Calculate overall opportunity score (0-100)"""
        score = 0
        
        # Trend score (30 points)
        if overall_trend == 'strong_bullish':
            score += 30
        elif overall_trend == 'bullish':
            score += 20
        elif overall_trend == 'neutral':
            score += 10
            
        # Volume score (20 points)
        volume_ratio = token.volume_24h / (token.market_cap + 1)
        if volume_ratio > 2:
            score += 20
        elif volume_ratio > 1:
            score += 15
        elif volume_ratio > 0.5:
            score += 10
        elif volume_ratio > 0.2:
            score += 5
            
        # Market cap score (20 points)
        if 1_000_000 <= token.market_cap <= 10_000_000:
            score += 20
        elif 500_000 <= token.market_cap <= 20_000_000:
            score += 15
        elif 100_000 <= token.market_cap <= 50_000_000:
            score += 10
            
        # Risk/reward score (15 points)
        score += min(risk_reward * 5, 15)
        
        # Confidence bonus (15 points)
        score += confidence * 0.15
        
        return min(score, 100)
        
    async def analyze_token(self, token: TokenData, 
                          price_history: Dict[str, List[float]] = None,
                          volume_history: Dict[str, List[float]] = None) -> MultiTimeframeAnalysis:
        """Perform complete multi-timeframe analysis"""
        
        # If no history provided, create mock data based on current metrics
        if not price_history:
            price_history = self._generate_mock_price_history(token)
        if not volume_history:
            volume_history = self._generate_mock_volume_history(token)
            
        # Analyze each timeframe
        timeframes = {}
        for tf in ['1h', '4h', '12h', '24h', '3d']:
            timeframes[tf] = self.analyze_timeframe(
                token, 
                tf,
                price_history.get(tf, []),
                volume_history.get(tf, [])
            )
            
        # Calculate aggregated metrics
        overall_trend = self.calculate_overall_trend(timeframes)
        entry_timing = self.calculate_entry_timing(token, timeframes, overall_trend)
        risk_reward = self.calculate_risk_reward(token, timeframes)
        confidence = self.calculate_confidence_level(timeframes, overall_trend, risk_reward)
        overall_score = self.calculate_overall_score(token, timeframes, overall_trend, 
                                                   risk_reward, confidence)
        
        return MultiTimeframeAnalysis(
            token=token,
            timeframes=timeframes,
            overall_trend=overall_trend,
            overall_score=overall_score,
            entry_timing=entry_timing,
            risk_reward_ratio=risk_reward,
            confidence_level=confidence,
            analysis_timestamp=datetime.utcnow()
        )
        
    def _generate_mock_price_history(self, token: TokenData) -> Dict[str, List[float]]:
        """Generate mock price history for testing"""
        current_price = token.price_usd
        price_change = token.price_change_24h / 100
        
        history = {}
        
        # Generate prices with some randomness
        for timeframe, points in [('1h', 12), ('4h', 12), ('12h', 12), ('24h', 24), ('3d', 36)]:
            prices = []
            price = current_price / (1 + price_change)  # Start price
            
            for i in range(points):
                # Add some volatility
                change = np.random.normal(price_change / points, 0.02)
                price *= (1 + change)
                prices.append(price)
                
            # Ensure last price matches current
            prices[-1] = current_price
            history[timeframe] = prices
            
        return history
        
    def _generate_mock_volume_history(self, token: TokenData) -> Dict[str, List[float]]:
        """Generate mock volume history for testing"""
        base_volume = token.volume_24h / 24  # Hourly average
        
        history = {}
        
        for timeframe, points in [('1h', 12), ('4h', 12), ('12h', 12), ('24h', 24), ('3d', 36)]:
            volumes = []
            for i in range(points):
                # Add variability
                volume = base_volume * np.random.uniform(0.5, 1.5)
                volumes.append(volume)
                
            history[timeframe] = volumes
            
        return history