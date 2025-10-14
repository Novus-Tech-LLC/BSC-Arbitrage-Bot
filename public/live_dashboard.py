import asyncio
from datetime import datetime
from typing import Dict, List, Optional
import os
import sys
from rich.console import Console
from rich.table import Table
from rich.layout import Layout
from rich.panel import Panel
from rich.live import Live
from rich.align import Align
from rich.text import Text
import logging

from dexscreener_api import DexScreenerAPI
from portfolio_tracker import PortfolioManager
from hourly_analyzer import HourlyAnalyzer, HourlyReport
from price_tracker import LivePriceTracker

logger = logging.getLogger(__name__)

class LiveDashboard:
    def __init__(self, api: DexScreenerAPI, portfolio_manager: PortfolioManager, 
                 analyzer: HourlyAnalyzer, price_tracker: LivePriceTracker):
        self.api = api
        self.portfolio = portfolio_manager
        self.analyzer = analyzer
        self.price_tracker = price_tracker
        self.console = Console()
        self.last_report: Optional[HourlyReport] = None
        self.refresh_interval = 5  # seconds
        
    def create_header(self) -> Panel:
        """Create dashboard header"""
        header_text = Text()
        header_text.append("🚀 CRYPTO ANALYSIS DASHBOARD", style="bold cyan")
        header_text.append(" | ", style="white")
        header_text.append("LIVE ON PUMP.FUN", style="bold magenta")
        header_text.append(" | ", style="white")
        header_text.append(datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC"), style="yellow")
        
        return Panel(Align.center(header_text), style="bold white on blue")
        
    def create_portfolio_panel(self) -> Panel:
        """Create portfolio status panel"""
        summary = self.portfolio.get_portfolio_summary()
        
        # Create portfolio table
        table = Table(show_header=False, box=None, padding=0)
        table.add_column(style="cyan", width=20)
        table.add_column(style="white")
        
        # Add summary rows
        total_value = summary['total_value']
        total_pnl = summary['total_pnl']
        pnl_color = "green" if total_pnl >= 0 else "red"
        
        table.add_row("💰 Total Value:", f"${total_value:,.2f}")
        table.add_row("📈 Total P&L:", f"[{pnl_color}]${total_pnl:,.2f} ({summary['total_pnl_percent']:+.1f}%)[/{pnl_color}]")
        table.add_row("💵 Cash Balance:", f"${summary['current_balance']:,.2f}")
        table.add_row("📊 Positions:", f"{summary['positions_count']}/10")
        table.add_row("🎯 Win Rate:", f"{summary['win_rate']:.1f}% ({summary['wins']}W/{summary['losses']}L)")
        
        return Panel(table, title="💼 Portfolio Status", border_style="cyan")
        
    def create_positions_table(self) -> Panel:
        """Create open positions table"""
        table = Table(title="", box=None, show_lines=False)
        table.add_column("Token", style="cyan", width=10)
        table.add_column("Entry", style="yellow", width=12)
        table.add_column("Current", style="white", width=12)
        table.add_column("Value", style="white", width=10)
        table.add_column("P&L", width=15)
        
        for position in self.portfolio.portfolio.positions.values():
            pnl_color = "green" if position.pnl_percent >= 0 else "red"
            pnl_emoji = "🟢" if position.pnl_percent >= 0 else "🔴"
            
            table.add_row(
                f"{pnl_emoji} {position.token_symbol}",
                f"${position.entry_price:.6f}",
                f"${position.current_price:.6f}",
                f"${position.position_value_usd:.2f}",
                f"[{pnl_color}]{position.pnl_percent:+.1f}%[/{pnl_color}]"
            )
            
        return Panel(table, title="📊 Open Positions", border_style="green")
        
    def create_analysis_panel(self) -> Panel:
        """Create analysis highlights panel"""
        if not self.last_report:
            return Panel("⏳ Waiting for first analysis report...", 
                        title="🔍 Analysis Highlights", border_style="yellow")
            
        lines = []
        
        # Market sentiment
        sentiment = self.last_report.market_summary['market_sentiment']
        sentiment_emoji = "🟢" if sentiment == 'bullish' else "🔴" if sentiment == 'bearish' else "🟡"
        lines.append(f"{sentiment_emoji} Market: {sentiment.upper()}")
        lines.append("")
        
        # Top opportunities
        if self.last_report.dust_like_tokens:
            lines.append("🌪️ Top DUST-like:")
            for token in self.last_report.dust_like_tokens[:3]:
                if token.category != 'dust_reference':
                    lines.append(f"  • {token.token.symbol} - Score: {token.opportunity_score:.0f}/100")
                    
        if self.last_report.priceless_like_tokens:
            lines.append("\n💎 Top PRICELESS-like:")
            for token in self.last_report.priceless_like_tokens[:3]:
                if token.category != 'priceless_reference':
                    lines.append(f"  • {token.token.symbol} - Score: {token.opportunity_score:.0f}/100")
                    
        if self.last_report.new_gems:
            lines.append("\n✨ New Gems Found: " + str(len(self.last_report.new_gems)))
            
        content = "\n".join(lines) if lines else "No analysis data yet"
        return Panel(content, title="🔍 Analysis Highlights", border_style="yellow")
        
    def create_alerts_panel(self) -> Panel:
        """Create recent alerts panel"""
        alerts = self.price_tracker.get_alerts()
        
        if not alerts:
            return Panel("No recent alerts", title="🚨 Price Alerts", border_style="red")
            
        lines = []
        for alert in alerts[:5]:
            token = alert['token']
            if alert['type'] == 'pump':
                lines.append(f"📈 PUMP: {token.symbol} +{alert['change_1h']:.1f}%")
            elif alert['type'] == 'dump':
                lines.append(f"📉 DUMP: {token.symbol} {alert['change_1h']:.1f}%")
            elif alert['type'] == 'volume_spike':
                lines.append(f"📊 VOL SPIKE: {token.symbol}")
                
        content = "\n".join(lines)
        return Panel(content, title="🚨 Recent Alerts", border_style="red")
        
    def create_reference_panel(self) -> Panel:
        """Create DUST/PRICELESS reference panel"""
        lines = []
        
        if self.last_report and self.last_report.dust_like_tokens:
            for token in self.last_report.dust_like_tokens:
                if token.category == 'dust_reference':
                    lines.append("🌪️ DUST REFERENCE")
                    lines.append(f"Price: ${token.token.price_usd:.8f}")
                    lines.append(f"MCap: ${token.token.market_cap:,.0f}")
                    lines.append(f"24h: {token.token.price_change_24h:+.1f}%")
                    lines.append(f"Vol/MCap: {token.token.volume_24h / (token.token.market_cap + 1):.2f}")
                    break
                    
        if self.last_report and self.last_report.priceless_like_tokens:
            if lines:
                lines.append("")
            for token in self.last_report.priceless_like_tokens:
                if token.category == 'priceless_reference':
                    lines.append("💎 PRICELESS REFERENCE")
                    lines.append(f"Price: ${token.token.price_usd:.8f}")
                    lines.append(f"MCap: ${token.token.market_cap:,.0f}")
                    lines.append(f"24h: {token.token.price_change_24h:+.1f}%")
                    lines.append(f"Vol/MCap: {token.token.volume_24h / (token.token.market_cap + 1):.2f}")
                    break
                    
        content = "\n".join(lines) if lines else "Loading reference data..."
        return Panel(content, title="📌 Token References", border_style="magenta")
        
    def create_layout(self) -> Layout:
        """Create dashboard layout"""
        layout = Layout()
        
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="main", size=20),
            Layout(name="bottom", size=10)
        )
        
        layout["main"].split_row(
            Layout(name="left", ratio=1),
            Layout(name="center", ratio=1),
            Layout(name="right", ratio=1)
        )
        
        layout["bottom"].split_row(
            Layout(name="alerts", ratio=2),
            Layout(name="reference", ratio=1)
        )
        
        # Add content to layouts
        layout["header"].update(self.create_header())
        layout["left"].update(self.create_portfolio_panel())
        layout["center"].update(self.create_positions_table())
        layout["right"].update(self.create_analysis_panel())
        layout["alerts"].update(self.create_alerts_panel())
        layout["reference"].update(self.create_reference_panel())
        
        return layout
        
    async def update_display(self):
        """Update display with latest data"""
        # Update prices for portfolio
        price_updates = {}
        for address in self.portfolio.portfolio.positions:
            try:
                token_data = await self.api.get_token_pairs(address)
                if token_data:
                    price_updates[address] = token_data[0].price_usd
            except:
                pass
                
        self.portfolio.portfolio.update_all_prices(price_updates)
        
    async def run(self):
        """Run the live dashboard"""
        with Live(self.create_layout(), refresh_per_second=1, console=self.console) as live:
            while True:
                try:
                    # Update data
                    await self.update_display()
                    
                    # Update layout
                    live.update(self.create_layout())
                    
                    # Wait before refresh
                    await asyncio.sleep(self.refresh_interval)
                    
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    logger.error(f"Dashboard error: {e}")
                    await asyncio.sleep(5)