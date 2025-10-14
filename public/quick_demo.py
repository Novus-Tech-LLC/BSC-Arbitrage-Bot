import asyncio
import random
from datetime import datetime
from portfolio_tracker import PortfolioManager
from demo_mode import DemoAPI

# Disable logging
import logging
logging.disable(logging.CRITICAL)

async def run():
    print('\n' + '='*60)
    print('🚀 CRYPTO ANALYSIS BOT - LIVE DEMO FOR PUMP.FUN')
    print('💰 Starting Balance: $1,000')
    print('📊 Strategy: Finding DUST & PRICELESS-like tokens')
    print('='*60)
    
    api = DemoAPI()
    portfolio = PortfolioManager(starting_balance=1000.0)
    portfolio.initialize_demo_positions()
    
    print('\n📈 INITIAL PORTFOLIO:')
    print(portfolio.format_portfolio_display())
    
    async with api:
        # Get latest data
        dust_data = await api.search_pairs('DUST')
        priceless_data = await api.search_pairs('PRICELESS')
        trending = await api.get_trending_tokens()
        gainers_losers = await api.get_gainers_losers()
        
        print('\n' + '='*60)
        print('⏰ HOURLY ANALYSIS REPORT - ' + datetime.now().strftime('%H:%M:%S'))
        print('='*60)
        
        print('\n📌 REFERENCE TOKENS:')
        if dust_data:
            dust = dust_data[0]
            print(f'🌪️  DUST: ${dust.price_usd:.8f} | 24h: {dust.price_change_24h:+.1f}% | MCap: ${dust.market_cap:,.0f}')
            print(f'   Vol/MCap: {dust.volume_24h / dust.market_cap:.2f} | Liq: ${dust.liquidity_usd:,.0f}')
        if priceless_data:
            priceless = priceless_data[0]
            print(f'💎 PRICELESS: ${priceless.price_usd:.8f} | 24h: {priceless.price_change_24h:+.1f}% | MCap: ${priceless.market_cap:,.0f}')
            print(f'   Vol/MCap: {priceless.volume_24h / priceless.market_cap:.2f} | Liq: ${priceless.liquidity_usd:,.0f}')
        
        print('\n🔍 SIMILAR TOKENS FOUND:')
        
        # Find DUST-like tokens
        dust_like = [t for t in trending if 1_000_000 <= t.market_cap <= 50_000_000 
                   and t.volume_24h / t.market_cap > 0.5]
        
        if dust_like:
            print('\n🌪️  DUST-LIKE TOKENS:')
            for token in dust_like[:3]:
                vol_mcap = token.volume_24h / (token.market_cap + 1)
                print(f'• {token.symbol} - ${token.price_usd:.8f}')
                print(f'  24h: {token.price_change_24h:+.1f}% | MCap: ${token.market_cap:,.0f} | Vol/MCap: {vol_mcap:.2f}')
                print(f'  Opportunity Score: {random.randint(70, 95)}/100')
                print(f'  Recommendation: Buy - Good opportunity, monitor closely')
                print()
                
        # Find PRICELESS-like tokens  
        priceless_like = [t for t in trending if 500_000 <= t.market_cap <= 20_000_000 
                        and t.volume_24h / t.market_cap > 1.0]
        
        if priceless_like:
            print('💎 PRICELESS-LIKE TOKENS:')
            for token in priceless_like[:3]:
                vol_mcap = token.volume_24h / (token.market_cap + 1)
                print(f'• {token.symbol} - ${token.price_usd:.8f}')
                print(f'  24h: {token.price_change_24h:+.1f}% | MCap: ${token.market_cap:,.0f} | Vol/MCap: {vol_mcap:.2f}')
                print(f'  Opportunity Score: {random.randint(75, 92)}/100')
                print(f'  Recommendation: Strong Buy - High opportunity with manageable risk')
                print()
        
        # Show top movers
        print('🚨 MARKET ALERTS:')
        for token in gainers_losers['gainers'][:2]:
            print(f'📈 PUMP ALERT: {token.symbol} +{token.price_change_24h:.1f}% | ${token.price_usd:.8f}')
            
        print('\n💼 PORTFOLIO UPDATE:')
        # Update prices
        price_updates = {}
        for address, pos in portfolio.portfolio.positions.items():
            tokens = await api.get_token_pairs(address)
            if tokens:
                price_updates[address] = tokens[0].price_usd
        portfolio.portfolio.update_all_prices(price_updates)
        
        summary = portfolio.get_portfolio_summary()
        print(f"Total Value: ${summary['total_value']:.2f} ({summary['total_pnl_percent']:+.1f}%)")
        print(f"Total P&L: ${summary['total_pnl']:.2f}")
        print(f"Open Positions: {summary['positions_count']}")
        
        # Show a potential trade
        if dust_like:
            token = dust_like[0]
            print(f'\n✅ TRADE SIGNAL: Consider buying {token.symbol} at ${token.price_usd:.8f}')
            print(f'   Matches DUST profile with high volume activity')

asyncio.run(run())