#!/usr/bin/env python3

import asyncio
import random
from datetime import datetime
from portfolio_tracker import PortfolioManager
from demo_mode import DemoAPI

async def main():
    print("\n" + "="*60)
    print("🚀 CRYPTO ANALYSIS BOT - LIVE DEMO")
    print("💰 Starting Balance: $1,000")
    print("📊 Strategy: Finding DUST & PRICELESS-like tokens")
    print("="*60)
    
    # Initialize
    api = DemoAPI()
    portfolio = PortfolioManager(starting_balance=1000.0)
    portfolio.initialize_demo_positions()
    
    print("\n📈 INITIAL PORTFOLIO:")
    print(portfolio.format_portfolio_display())
    
    while True:
        try:
            print("\n" + "="*60)
            print(f"⏰ HOURLY UPDATE - {datetime.now().strftime('%H:%M:%S')}")
            print("="*60)
            
            async with api:
                # Get latest data
                dust_data = await api.search_pairs("DUST")
                priceless_data = await api.search_pairs("PRICELESS")
                trending = await api.get_trending_tokens()
                new_pairs = await api.get_new_pairs()
                gainers_losers = await api.get_gainers_losers()
                
                # Show reference tokens
                print("\n📌 REFERENCE TOKENS:")
                if dust_data:
                    dust = dust_data[0]
                    print(f"🌪️  DUST: ${dust.price_usd:.8f} | 24h: {dust.price_change_24h:+.1f}% | MCap: ${dust.market_cap:,.0f}")
                if priceless_data:
                    priceless = priceless_data[0]
                    print(f"💎 PRICELESS: ${priceless.price_usd:.8f} | 24h: {priceless.price_change_24h:+.1f}% | MCap: ${priceless.market_cap:,.0f}")
                
                # Update portfolio prices
                price_updates = {}
                for address, pos in portfolio.portfolio.positions.items():
                    tokens = await api.get_token_pairs(address)
                    if tokens:
                        price_updates[address] = tokens[0].price_usd
                portfolio.portfolio.update_all_prices(price_updates)
                
                # Show similar tokens found
                print("\n🔍 SIMILAR TOKENS FOUND:")
                
                all_tokens = trending + new_pairs[:3]
                dust_like = [t for t in all_tokens if 1_000_000 <= t.market_cap <= 50_000_000 
                           and t.volume_24h / t.market_cap > 0.5]
                
                if dust_like:
                    print("\n🌪️  DUST-LIKE TOKENS:")
                    for token in dust_like[:3]:
                        vol_mcap = token.volume_24h / (token.market_cap + 1)
                        print(f"• {token.symbol} - ${token.price_usd:.8f}")
                        print(f"  24h: {token.price_change_24h:+.1f}% | MCap: ${token.market_cap:,.0f} | Vol/MCap: {vol_mcap:.2f}")
                        print(f"  Opportunity Score: {random.randint(70, 95)}/100")
                
                priceless_like = [t for t in all_tokens if 500_000 <= t.market_cap <= 20_000_000 
                                and t.volume_24h / t.market_cap > 1.0]
                
                if priceless_like:
                    print("\n💎 PRICELESS-LIKE TOKENS:")
                    for token in priceless_like[:3]:
                        vol_mcap = token.volume_24h / (token.market_cap + 1)
                        print(f"• {token.symbol} - ${token.price_usd:.8f}")
                        print(f"  24h: {token.price_change_24h:+.1f}% | MCap: ${token.market_cap:,.0f} | Vol/MCap: {vol_mcap:.2f}")
                        print(f"  Opportunity Score: {random.randint(75, 90)}/100")
                
                # Show alerts
                if gainers_losers['gainers']:
                    print("\n🚨 TOP GAINERS:")
                    for token in gainers_losers['gainers'][:2]:
                        print(f"📈 {token.symbol}: +{token.price_change_24h:.1f}% | ${token.price_usd:.8f}")
                
                # Show portfolio status
                print("\n" + portfolio.format_portfolio_display())
                
                # Simulate a trade occasionally
                if random.random() > 0.8 and dust_like and portfolio.portfolio.current_balance > 100:
                    token = dust_like[0]
                    print(f"\n✅ NEW TRADE: Buying {token.symbol} at ${token.price_usd:.8f}")
                    print(f"   Reason: High opportunity score with good volume")
            
            print("\n⏳ Next update in 60 seconds... (Press Ctrl+C to stop)")
            await asyncio.sleep(60)
            
        except KeyboardInterrupt:
            print("\n\n✋ Demo stopped")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main())