#!/usr/bin/env python3

import asyncio
import random
from datetime import datetime, timedelta
from typing import List

from dexscreener_api import TokenData
from portfolio_tracker import PortfolioManager
from hourly_analyzer import HourlyAnalyzer, HourlyReport
from price_tracker import LivePriceTracker
from live_dashboard import LiveDashboard
from notifier import NotificationSystem, ConsoleNotificationChannel

class DemoAPI:
    """Demo API that generates fake token data for testing"""
    
    def __init__(self):
        self.session = None
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
        
    def _generate_token(self, symbol: str, base_price: float, base_mcap: float) -> TokenData:
        """Generate fake token data"""
        price_variation = random.uniform(0.8, 1.2)
        price = base_price * price_variation
        mcap = base_mcap * price_variation
        volume_ratio = random.uniform(0.5, 3.0)
        
        return TokenData(
            address=f"0x{random.randbytes(20).hex()}",
            symbol=symbol,
            name=f"{symbol} Token",
            price_usd=price,
            price_change_24h=random.uniform(-30, 100),
            volume_24h=mcap * volume_ratio,
            liquidity_usd=mcap * random.uniform(0.1, 0.5),
            market_cap=mcap,
            fdv=mcap * 1.2,
            chain="ethereum",
            pair_address=f"0x{random.randbytes(20).hex()}",
            created_at=(datetime.utcnow() - timedelta(hours=random.randint(1, 168))).isoformat()
        )
        
    async def search_pairs(self, query: str) -> List[TokenData]:
        """Simulate search"""
        if query.upper() == "DUST":
            return [self._generate_token("DUST", 0.000312, 15_000_000)]
        elif query.upper() == "PRICELESS":
            return [self._generate_token("PRICELESS", 0.00001156, 8_000_000)]
        return []
        
    async def get_trending_tokens(self) -> List[TokenData]:
        """Generate fake trending tokens"""
        symbols = ["WAGMI", "MOON", "ROCKET", "PUMP", "HODL", "PEPE", "WOJAK", "COPE"]
        tokens = []
        for symbol in symbols[:5]:
            base_price = random.uniform(0.00001, 0.01)
            base_mcap = random.uniform(1_000_000, 50_000_000)
            tokens.append(self._generate_token(symbol, base_price, base_mcap))
        return tokens
        
    async def get_new_pairs(self, hours: int = 4) -> List[TokenData]:
        """Generate fake new pairs"""
        symbols = ["GEM", "ALPHA", "BETA", "GAMMA", "DELTA"]
        tokens = []
        for symbol in symbols[:3]:
            base_price = random.uniform(0.000001, 0.001)
            base_mcap = random.uniform(100_000, 5_000_000)
            tokens.append(self._generate_token(symbol, base_price, base_mcap))
        return tokens
        
    async def get_gainers_losers(self):
        """Generate fake gainers and losers"""
        gainers = []
        for symbol in ["BULL", "PUMP", "MOON"]:
            token = self._generate_token(symbol, random.uniform(0.0001, 0.01), random.uniform(2_000_000, 20_000_000))
            token.price_change_24h = random.uniform(50, 200)
            gainers.append(token)
            
        losers = []
        for symbol in ["BEAR", "DUMP", "RUG"]:
            token = self._generate_token(symbol, random.uniform(0.0001, 0.01), random.uniform(1_000_000, 10_000_000))
            token.price_change_24h = random.uniform(-60, -20)
            losers.append(token)
            
        return {"gainers": gainers, "losers": losers}
        
    async def get_token_pairs(self, address: str) -> List[TokenData]:
        """Get token pairs for price updates"""
        # Return slightly modified price for existing positions
        if address == "0xb5b9dEd77E24263Bb5996D66749BBc88CB89Bd7F":  # DUST
            return [self._generate_token("DUST", 0.000312 * random.uniform(0.95, 1.05), 15_000_000)]
        elif address == "0x892d50AdaA07073C640C0bABE74c85Dd89edE8F0":  # PRICELESS
            return [self._generate_token("PRICELESS", 0.00001156 * random.uniform(0.95, 1.05), 8_000_000)]
        elif address == "0x73c2a42ceB7C7bBa0bFA108015A65f06765dF109":  # WAGMI
            return [self._generate_token("WAGMI", 0.000143 * random.uniform(0.95, 1.05), 5_000_000)]
        return []

async def run_demo():
    """Run demo mode with simulated data"""
    print("\n🚀 Starting Crypto Analysis Bot in DEMO MODE...")
    print("📌 This is a simulation for testing/streaming purposes\n")
    
    # Initialize components
    demo_api = DemoAPI()
    portfolio_manager = PortfolioManager(starting_balance=1000.0)
    portfolio_manager.initialize_demo_positions()
    
    price_tracker = LivePriceTracker(demo_api)
    analyzer = HourlyAnalyzer(demo_api, price_tracker)
    dashboard = LiveDashboard(demo_api, portfolio_manager, analyzer, price_tracker)
    
    # Create notification system
    notifier = NotificationSystem()
    
    async def run_analysis_loop():
        """Run analysis every minute in demo mode"""
        while True:
            try:
                async with demo_api:
                    report = await analyzer.perform_hourly_analysis()
                    dashboard.last_report = report
                    
                    # Update portfolio with simulated trades
                    if random.random() > 0.7:  # 30% chance of trade
                        all_tokens = report.dust_like_tokens + report.priceless_like_tokens
                        if all_tokens and len(portfolio_manager.portfolio.positions) < 10:
                            token = random.choice(all_tokens).token
                            if portfolio_manager.should_buy(token.opportunity_score, "low", len(portfolio_manager.portfolio.positions)):
                                # Simulate buying
                                print(f"\n💰 DEMO BUY: {token.symbol} at ${token.price_usd:.8f}")
                                
                await asyncio.sleep(60)  # 1 minute intervals
                
            except Exception as e:
                print(f"Demo analysis error: {e}")
                await asyncio.sleep(10)
                
    async def update_prices_loop():
        """Update prices every 5 seconds"""
        while True:
            try:
                # Get price updates for positions
                price_updates = {}
                for address in portfolio_manager.portfolio.positions:
                    tokens = await demo_api.get_token_pairs(address)
                    if tokens:
                        price_updates[address] = tokens[0].price_usd
                        
                portfolio_manager.portfolio.update_all_prices(price_updates)
                await asyncio.sleep(5)
                
            except Exception as e:
                print(f"Price update error: {e}")
                await asyncio.sleep(5)
    
    # Run all tasks
    tasks = [
        asyncio.create_task(dashboard.run()),
        asyncio.create_task(run_analysis_loop()),
        asyncio.create_task(update_prices_loop())
    ]
    
    try:
        await asyncio.gather(*tasks)
    except KeyboardInterrupt:
        print("\n\n✋ Demo stopped by user")
        
if __name__ == "__main__":
    asyncio.run(run_demo())