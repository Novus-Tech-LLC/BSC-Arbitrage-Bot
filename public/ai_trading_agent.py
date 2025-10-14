import asyncio
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import json
import logging
from enum import Enum

from dexscreener_api import DexScreenerAPI, TokenData
from portfolio_tracker import PortfolioManager, Position
from multi_timeframe_analyzer import MultiTimeframeAnalyzer, MultiTimeframeAnalysis
from token_similarity import TokenSimilarityDetector

logger = logging.getLogger(__name__)

class TradingStrategy(Enum):
    SCALPING = "scalping"  # 1-4h holds
    SWING = "swing"  # 4-24h holds
    POSITION = "position"  # 1-3d holds

@dataclass
class TradingDecision:
    action: str  # 'buy', 'sell', 'hold'
    token: TokenData
    reason: str
    confidence: float
    suggested_amount: float
    strategy: TradingStrategy
    analysis: MultiTimeframeAnalysis

@dataclass
class AgentState:
    total_trades: int = 0
    successful_trades: int = 0
    failed_trades: int = 0
    total_profit: float = 0
    best_trade: Optional[Dict] = None
    worst_trade: Optional[Dict] = None
    current_strategy_preference: TradingStrategy = TradingStrategy.SWING

class AITradingAgent:
    def __init__(self, api: DexScreenerAPI, starting_balance: float = 1000.0):
        self.api = api
        self.portfolio = PortfolioManager(starting_balance=starting_balance)
        self.analyzer = MultiTimeframeAnalyzer()
        self.similarity_detector = TokenSimilarityDetector()
        self.state = AgentState()
        
        # Configuration
        self.min_capital_reserve = 500.0  # Always keep $500 in reserve
        self.max_position_size = 0.2  # Max 20% of available capital per position
        self.max_positions = 5  # Maximum concurrent positions
        self.min_confidence = 65  # Minimum confidence for trades
        
        # Risk management
        self.stop_loss_pct = 15  # Stop loss at -15%
        self.take_profit_targets = {
            TradingStrategy.SCALPING: 25,  # +25% for scalping
            TradingStrategy.SWING: 50,  # +50% for swing
            TradingStrategy.POSITION: 100  # +100% for position
        }
        
        # Token tracking
        self.analyzed_tokens: Dict[str, MultiTimeframeAnalysis] = {}
        self.watchlist: List[str] = []
        
    def get_available_capital(self) -> float:
        """Get capital available for trading (respecting reserve)"""
        total_value = self.portfolio.portfolio.get_total_value()
        return max(0, total_value - self.min_capital_reserve)
        
    def can_open_position(self) -> bool:
        """Check if we can open a new position"""
        return (len(self.portfolio.portfolio.positions) < self.max_positions and 
                self.get_available_capital() > 50)  # Min $50 for a position
                
    def calculate_position_size(self, token_price: float, confidence: float) -> float:
        """Calculate position size based on confidence and available capital"""
        available = self.get_available_capital()
        
        # Base size is 10-20% of available capital based on confidence
        confidence_factor = (confidence - 50) / 50  # 0 to 1
        position_pct = 0.1 + (0.1 * confidence_factor)  # 10% to 20%
        
        position_value = available * position_pct
        return position_value / token_price if token_price > 0 else 0
        
    async def analyze_token_opportunity(self, token: TokenData) -> Optional[TradingDecision]:
        """Analyze a token and decide whether to trade"""
        
        # Skip if we already have this position
        if token.address in self.portfolio.portfolio.positions:
            return await self._analyze_existing_position(token)
            
        # Perform multi-timeframe analysis
        analysis = await self.analyzer.analyze_token(token)
        self.analyzed_tokens[token.address] = analysis
        
        # Skip if confidence too low
        if analysis.confidence_level < self.min_confidence:
            return None
            
        # Skip if entry timing is 'avoid'
        if analysis.entry_timing == 'avoid':
            return None
            
        # Check if it matches our target profiles (DUST/PRICELESS-like)
        token_metrics = self.similarity_detector.analyze_token(token)
        
        # Decision logic
        if analysis.overall_score >= 80 and analysis.entry_timing == 'immediate':
            strategy = self._select_strategy(analysis)
            position_size = self.calculate_position_size(token.price_usd, analysis.confidence_level)
            
            return TradingDecision(
                action='buy',
                token=token,
                reason=f"High score ({analysis.overall_score:.0f}), {analysis.overall_trend} trend, good entry",
                confidence=analysis.confidence_level,
                suggested_amount=position_size,
                strategy=strategy,
                analysis=analysis
            )
        elif analysis.overall_score >= 70 and analysis.entry_timing == 'wait_dip':
            # Add to watchlist for dip buying
            if token.address not in self.watchlist:
                self.watchlist.append(token.address)
            return None
            
        return None
        
    async def _analyze_existing_position(self, token: TokenData) -> Optional[TradingDecision]:
        """Analyze existing position for exit decision"""
        position = self.portfolio.portfolio.positions.get(token.address)
        if not position:
            return None
            
        # Update position price
        position.update_price(token.price_usd)
        
        # Get fresh analysis
        analysis = await self.analyzer.analyze_token(token)
        
        # Exit conditions
        should_sell = False
        reason = ""
        
        # Stop loss
        if position.pnl_percent <= -self.stop_loss_pct:
            should_sell = True
            reason = f"Stop loss triggered ({position.pnl_percent:.1f}%)"
            
        # Take profit based on strategy
        elif position.pnl_percent >= self.take_profit_targets.get(self.state.current_strategy_preference, 50):
            should_sell = True
            reason = f"Take profit target reached ({position.pnl_percent:.1f}%)"
            
        # Trend reversal
        elif analysis.overall_trend in ['bearish', 'strong_bearish'] and position.pnl_percent > 10:
            should_sell = True
            reason = f"Trend reversal detected, securing {position.pnl_percent:.1f}% profit"
            
        # Time-based exit for scalping
        elif self.state.current_strategy_preference == TradingStrategy.SCALPING:
            hours_held = (datetime.utcnow() - position.entry_time).total_seconds() / 3600
            if hours_held > 4 and position.pnl_percent > 5:
                should_sell = True
                reason = f"Scalping time limit reached with {position.pnl_percent:.1f}% profit"
                
        if should_sell:
            return TradingDecision(
                action='sell',
                token=token,
                reason=reason,
                confidence=90,  # High confidence on exits
                suggested_amount=position.quantity,
                strategy=self.state.current_strategy_preference,
                analysis=analysis
            )
            
        return None
        
    def _select_strategy(self, analysis: MultiTimeframeAnalysis) -> TradingStrategy:
        """Select trading strategy based on analysis"""
        
        # High volatility = scalping
        avg_volatility = sum(tf.volatility for tf in analysis.timeframes.values()) / len(analysis.timeframes)
        if avg_volatility > 15:
            return TradingStrategy.SCALPING
            
        # Strong multi-timeframe trend = position trading
        if analysis.overall_trend == 'strong_bullish' and analysis.risk_reward_ratio > 2:
            return TradingStrategy.POSITION
            
        # Default to swing trading
        return TradingStrategy.SWING
        
    async def execute_decision(self, decision: TradingDecision) -> bool:
        """Execute a trading decision"""
        try:
            if decision.action == 'buy':
                if not self.can_open_position():
                    logger.info("Cannot open new position - limit reached or insufficient capital")
                    return False
                    
                # Create position
                position = Position(
                    token_symbol=decision.token.symbol,
                    token_address=decision.token.address,
                    entry_price=decision.token.price_usd,
                    current_price=decision.token.price_usd,
                    quantity=decision.suggested_amount,
                    entry_time=datetime.utcnow()
                )
                
                # Check if we have enough balance
                cost = position.entry_price * position.quantity
                if cost > self.portfolio.portfolio.current_balance:
                    logger.info(f"Insufficient balance for {decision.token.symbol}")
                    return False
                    
                self.portfolio.portfolio.add_position(position)
                self.state.total_trades += 1
                
                logger.info(f"BUY: {decision.token.symbol} - ${cost:.2f} @ ${decision.token.price_usd:.8f}")
                logger.info(f"Reason: {decision.reason}")
                
                return True
                
            elif decision.action == 'sell':
                # Get position data before closing
                position = self.portfolio.portfolio.positions.get(decision.token.address)
                if position:
                    position.update_price(decision.token.price_usd)
                    pnl = position.pnl_usd
                    
                success = self.portfolio.portfolio.close_position(
                    decision.token.address,
                    decision.token.price_usd,
                    decision.reason
                )
                
                if success and position:
                    if pnl > 0:
                        self.state.successful_trades += 1
                    else:
                        self.state.failed_trades += 1
                        
                    self.state.total_profit += pnl
                        
                    logger.info(f"SELL: {decision.token.symbol} - {decision.reason}")
                    
                return success
                
        except Exception as e:
            logger.error(f"Error executing decision: {e}")
            return False
            
    async def scan_market(self) -> List[TradingDecision]:
        """Scan market for opportunities"""
        decisions = []
        
        # Get market data
        trending = await self.api.get_trending_tokens()
        new_pairs = await self.api.get_new_pairs(hours=4)
        gainers_losers = await self.api.get_gainers_losers()
        
        # Search for DUST and PRICELESS
        dust_search = await self.api.search_pairs("DUST")
        priceless_search = await self.api.search_pairs("PRICELESS")
        
        # Combine all tokens
        all_tokens = trending + new_pairs + gainers_losers.get('gainers', [])
        if dust_search:
            all_tokens.extend(dust_search[:1])
        if priceless_search:
            all_tokens.extend(priceless_search[:1])
            
        # Analyze each token
        for token in all_tokens:
            decision = await self.analyze_token_opportunity(token)
            if decision:
                decisions.append(decision)
                
        # Check existing positions
        for position in list(self.portfolio.portfolio.positions.values()):
            token_data = await self.api.get_token_pairs(position.token_address)
            if token_data:
                decision = await self._analyze_existing_position(token_data[0])
                if decision:
                    decisions.append(decision)
                    
        # Sort by confidence
        decisions.sort(key=lambda d: d.confidence, reverse=True)
        
        return decisions
        
    def get_agent_stats(self) -> Dict:
        """Get agent performance statistics"""
        total_value = self.portfolio.portfolio.get_total_value()
        
        return {
            'total_value': total_value,
            'total_profit': self.state.total_profit,
            'roi_percent': ((total_value - 1000) / 1000) * 100,
            'total_trades': self.state.total_trades,
            'successful_trades': self.state.successful_trades,
            'failed_trades': self.state.failed_trades,
            'win_rate': (self.state.successful_trades / self.state.total_trades * 100) 
                       if self.state.total_trades > 0 else 0,
            'positions_open': len(self.portfolio.portfolio.positions),
            'available_capital': self.get_available_capital(),
            'tokens_analyzed': len(self.analyzed_tokens),
            'watchlist_size': len(self.watchlist)
        }
        
    def format_status_report(self) -> str:
        """Format a status report for display"""
        stats = self.get_agent_stats()
        
        lines = []
        lines.append("\n🤖 AI TRADING AGENT STATUS")
        lines.append("=" * 50)
        lines.append(f"💰 Total Value: ${stats['total_value']:.2f} ({stats['roi_percent']:+.1f}% ROI)")
        lines.append(f"💵 Available Capital: ${stats['available_capital']:.2f}")
        lines.append(f"📊 Open Positions: {stats['positions_open']}/{self.max_positions}")
        lines.append(f"📈 Total Trades: {stats['total_trades']} (Win Rate: {stats['win_rate']:.1f}%)")
        lines.append(f"🔍 Tokens Analyzed: {stats['tokens_analyzed']}")
        lines.append(f"👀 Watchlist: {stats['watchlist_size']} tokens")
        
        return '\n'.join(lines)