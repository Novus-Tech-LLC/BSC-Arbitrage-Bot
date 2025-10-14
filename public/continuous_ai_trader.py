#!/usr/bin/env python3

import asyncio
from datetime import datetime, timedelta
import random
import logging
from typing import Dict, List
import signal
import sys

from demo_mode import DemoAPI
from ai_trading_agent import AITradingAgent, TradingDecision
from portfolio_tracker import Position

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

class ContinuousAITrader:
    def __init__(self):
        self.api = DemoAPI()
        self.agent = AITradingAgent(self.api, starting_balance=1000.0)
        self.is_running = True
        
        # Check intervals for different types of actions
        self.check_intervals = {
            'market_scan': 300,  # 5 minutes - scan for new opportunities
            'position_check': 60,  # 1 minute - check existing positions
            'deep_analysis': 900,  # 15 minutes - deep analysis of watchlist
            'status_report': 600,  # 10 minutes - print status report
        }
        
        # Initialize with some positions (using $500 of the $1000)
        self._initialize_positions()
        
    def _initialize_positions(self):
        """Start with some initial positions using $500"""
        initial_positions = [
            {
                'symbol': 'MOON',
                'address': '0x' + 'a' * 40,
                'entry_price': 0.000156,
                'quantity': 1000000,  # ~$156
                'entry_time': datetime.utcnow() - timedelta(hours=2)
            },
            {
                'symbol': 'ROCKET',
                'address': '0x' + 'b' * 40,
                'entry_price': 0.00234,
                'quantity': 85470,  # ~$200
                'entry_time': datetime.utcnow() - timedelta(hours=5)
            },
            {
                'symbol': 'WAGMI',
                'address': '0x' + 'c' * 40,
                'entry_price': 0.000891,
                'quantity': 168539,  # ~$150
                'entry_time': datetime.utcnow() - timedelta(hours=1)
            }
        ]
        
        for pos_data in initial_positions:
            position = Position(
                token_symbol=pos_data['symbol'],
                token_address=pos_data['address'],
                entry_price=pos_data['entry_price'],
                current_price=pos_data['entry_price'] * random.uniform(0.9, 1.3),
                quantity=pos_data['quantity'],
                entry_time=pos_data['entry_time']
            )
            position.update_price(position.current_price)
            self.agent.portfolio.portfolio.add_position(position)
            
        logger.info(f"Initialized with {len(initial_positions)} positions using ~$500")
        
    async def market_scan_loop(self):
        """Continuously scan market for opportunities"""
        while self.is_running:
            try:
                logger.info("🔍 Scanning market for opportunities...")
                
                async with self.api:
                    decisions = await self.agent.scan_market()
                    
                    # Execute top decisions
                    executed = 0
                    for decision in decisions[:3]:  # Top 3 opportunities
                        if decision.action == 'buy' and self.agent.can_open_position():
                            success = await self.agent.execute_decision(decision)
                            if success:
                                executed += 1
                                await asyncio.sleep(2)  # Small delay between trades
                                
                    if executed > 0:
                        logger.info(f"✅ Executed {executed} new trades")
                    else:
                        logger.info("No new opportunities met criteria")
                        
            except Exception as e:
                logger.error(f"Market scan error: {e}")
                
            await asyncio.sleep(self.check_intervals['market_scan'])
            
    async def position_check_loop(self):
        """Check existing positions for exit opportunities"""
        while self.is_running:
            try:
                if self.agent.portfolio.portfolio.positions:
                    async with self.api:
                        # Update all position prices
                        for position in list(self.agent.portfolio.portfolio.positions.values()):
                            # Simulate price movement
                            new_price = position.current_price * random.uniform(0.97, 1.03)
                            position.update_price(new_price)
                            
                            # Create mock token data
                            token_data = self.api._generate_token(
                                position.token_symbol,
                                new_price,
                                new_price * 10_000_000  # Mock market cap
                            )
                            
                            # Check if we should exit
                            decision = await self.agent._analyze_existing_position(token_data)
                            if decision and decision.action == 'sell':
                                success = await self.agent.execute_decision(decision)
                                if success:
                                    logger.info(f"💰 Closed position: {position.token_symbol}")
                                    
            except Exception as e:
                logger.error(f"Position check error: {e}")
                
            await asyncio.sleep(self.check_intervals['position_check'])
            
    async def deep_analysis_loop(self):
        """Perform deep analysis on watchlist tokens"""
        while self.is_running:
            try:
                if self.agent.watchlist:
                    logger.info(f"🧠 Deep analysis of {len(self.agent.watchlist)} watchlist tokens...")
                    
                    async with self.api:
                        for token_address in self.agent.watchlist[:5]:  # Top 5 watchlist
                            # Simulate getting updated data
                            token = self.api._generate_token(
                                f"WATCH{random.randint(1, 99)}",
                                random.uniform(0.00001, 0.01),
                                random.uniform(500_000, 20_000_000)
                            )
                            token.address = token_address
                            
                            # Re-analyze
                            decision = await self.agent.analyze_token_opportunity(token)
                            if decision and decision.action == 'buy':
                                logger.info(f"📍 Watchlist token {token.symbol} now ready to buy!")
                                
            except Exception as e:
                logger.error(f"Deep analysis error: {e}")
                
            await asyncio.sleep(self.check_intervals['deep_analysis'])
            
    async def status_report_loop(self):
        """Print regular status reports"""
        while self.is_running:
            try:
                print("\n" + "="*60)
                print(f"📅 STATUS REPORT - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                print("="*60)
                
                # Agent stats
                print(self.agent.format_status_report())
                
                # Portfolio details
                print(self.agent.portfolio.format_portfolio_display())
                
                # Recent analysis summary
                print("\n📊 RECENT ANALYSIS:")
                recent_analyses = sorted(
                    self.agent.analyzed_tokens.items(),
                    key=lambda x: x[1].analysis_timestamp,
                    reverse=True
                )[:5]
                
                for address, analysis in recent_analyses:
                    print(f"\n{analysis.token.symbol}:")
                    print(f"  Score: {analysis.overall_score:.0f}/100")
                    print(f"  Trend: {analysis.overall_trend}")
                    print(f"  Entry: {analysis.entry_timing}")
                    print(f"  R/R: {analysis.risk_reward_ratio:.1f}")
                    print(f"  Confidence: {analysis.confidence_level:.0f}%")
                    
                    # Show timeframe data
                    print("  Timeframes:")
                    for tf, data in analysis.timeframes.items():
                        print(f"    {tf}: {data.price_change:+.1f}% | {data.price_momentum}")
                        
            except Exception as e:
                logger.error(f"Status report error: {e}")
                
            await asyncio.sleep(self.check_intervals['status_report'])
            
    async def run(self):
        """Run all trading loops"""
        print("\n" + "="*60)
        print("🤖 CONTINUOUS AI TRADING AGENT STARTED")
        print("💰 Starting Balance: $1,000 ($500 capital + $500 in positions)")
        print("📊 Strategy: Multi-timeframe analysis with AI decision making")
        print("🎯 Target: DUST & PRICELESS-like tokens")
        print("="*60 + "\n")
        
        # Show initial status
        print(self.agent.format_status_report())
        print(self.agent.portfolio.format_portfolio_display())
        
        # Create all tasks
        tasks = [
            asyncio.create_task(self.market_scan_loop()),
            asyncio.create_task(self.position_check_loop()),
            asyncio.create_task(self.deep_analysis_loop()),
            asyncio.create_task(self.status_report_loop())
        ]
        
        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            logger.info("Trading loops cancelled")
            
    def stop(self):
        """Stop all trading loops"""
        self.is_running = False
        logger.info("Stopping AI trader...")

async def main():
    trader = ContinuousAITrader()
    
    # Handle shutdown
    def signal_handler(sig, frame):
        print("\n\n📊 FINAL REPORT:")
        print(trader.agent.format_status_report())
        print("\n✋ AI Trader stopped")
        trader.stop()
        sys.exit(0)
        
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    await trader.run()

if __name__ == "__main__":
    asyncio.run(main())