import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime
import json
import aiofiles
from abc import ABC, abstractmethod
import logging
from dataclasses import dataclass

from hourly_analyzer import HourlyReport, TokenAnalysis

logger = logging.getLogger(__name__)

@dataclass
class Notification:
    timestamp: datetime
    type: str  # 'hourly_report', 'price_alert', 'new_gem', 'volume_spike'
    priority: str  # 'low', 'medium', 'high', 'critical'
    title: str
    message: str
    data: Dict[str, Any]

class NotificationChannel(ABC):
    @abstractmethod
    async def send(self, notification: Notification) -> bool:
        pass

class FileNotificationChannel(NotificationChannel):
    """Save notifications to file"""
    def __init__(self, output_dir: str = "./notifications"):
        self.output_dir = output_dir
        
    async def send(self, notification: Notification) -> bool:
        try:
            filename = f"{self.output_dir}/{notification.timestamp.strftime('%Y%m%d_%H%M%S')}_{notification.type}.json"
            
            data = {
                'timestamp': notification.timestamp.isoformat(),
                'type': notification.type,
                'priority': notification.priority,
                'title': notification.title,
                'message': notification.message,
                'data': notification.data
            }
            
            async with aiofiles.open(filename, 'w') as f:
                await f.write(json.dumps(data, indent=2))
                
            logger.info(f"Notification saved to {filename}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save notification: {e}")
            return False

class ConsoleNotificationChannel(NotificationChannel):
    """Print notifications to console"""
    async def send(self, notification: Notification) -> bool:
        try:
            print(f"\n{'='*60}")
            print(f"🔔 {notification.priority.upper()} ALERT: {notification.title}")
            print(f"Time: {notification.timestamp.strftime('%Y-%m-%d %H:%M UTC')}")
            print(f"{'='*60}")
            print(notification.message)
            print(f"{'='*60}\n")
            return True
            
        except Exception as e:
            logger.error(f"Failed to print notification: {e}")
            return False

class WebhookNotificationChannel(NotificationChannel):
    """Send notifications via webhook"""
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url
        
    async def send(self, notification: Notification) -> bool:
        # Implementation would send to Discord, Telegram, etc.
        # For now, just log
        logger.info(f"Would send to webhook: {notification.title}")
        return True

class NotificationSystem:
    def __init__(self):
        self.channels: List[NotificationChannel] = []
        self.notification_history: List[Notification] = []
        self.filters = {
            'min_opportunity_score': 70,
            'max_risk_level': 'high',
            'min_price_change': 20,
            'min_volume_spike': 2.0
        }
        
    def add_channel(self, channel: NotificationChannel):
        """Add notification channel"""
        self.channels.append(channel)
        
    def set_filter(self, key: str, value: Any):
        """Set notification filter"""
        self.filters[key] = value
        
    async def notify(self, notification: Notification):
        """Send notification through all channels"""
        self.notification_history.append(notification)
        
        # Send through all channels
        for channel in self.channels:
            await channel.send(notification)
            
    async def process_hourly_report(self, report: HourlyReport):
        """Process hourly report and generate notifications"""
        
        # Generate hourly summary notification
        summary_notification = Notification(
            timestamp=report.timestamp,
            type='hourly_report',
            priority='medium',
            title='Hourly Crypto Analysis Report',
            message=self._format_hourly_summary(report),
            data={'report_timestamp': report.timestamp.isoformat()}
        )
        await self.notify(summary_notification)
        
        # Check for high opportunity tokens
        all_tokens = (report.dust_like_tokens + report.priceless_like_tokens + 
                     report.new_gems + report.trending_tokens)
        
        for analysis in all_tokens:
            # High opportunity alert
            if analysis.opportunity_score >= self.filters['min_opportunity_score']:
                await self._notify_high_opportunity(analysis)
                
            # Large price movement alert
            if abs(analysis.token.price_change_24h) >= self.filters['min_price_change']:
                await self._notify_price_movement(analysis)
                
        # Process price alerts
        for alert in report.price_alerts:
            await self._notify_price_alert(alert)
            
        # New gems notification
        if report.new_gems:
            await self._notify_new_gems(report.new_gems)
            
    async def _notify_high_opportunity(self, analysis: TokenAnalysis):
        """Notify about high opportunity token"""
        notification = Notification(
            timestamp=datetime.utcnow(),
            type='high_opportunity',
            priority='high',
            title=f'High Opportunity: {analysis.token.symbol}',
            message=f"""
🎯 High Opportunity Token Detected!

Symbol: {analysis.token.symbol}
Price: ${analysis.token.price_usd:.8f}
Market Cap: ${analysis.token.market_cap:,.0f}
24h Change: {analysis.token.price_change_24h:+.1f}%
Opportunity Score: {analysis.opportunity_score:.0f}/100
Risk Level: {analysis.risk_assessment['risk_level']}

{analysis.recommendation}

Chain: {analysis.token.chain}
Contract: {analysis.token.address}
            """.strip(),
            data={
                'token': analysis.token.symbol,
                'address': analysis.token.address,
                'score': analysis.opportunity_score
            }
        )
        await self.notify(notification)
        
    async def _notify_price_movement(self, analysis: TokenAnalysis):
        """Notify about large price movement"""
        direction = "📈 PUMP" if analysis.token.price_change_24h > 0 else "📉 DUMP"
        
        notification = Notification(
            timestamp=datetime.utcnow(),
            type='price_movement',
            priority='high' if abs(analysis.token.price_change_24h) > 50 else 'medium',
            title=f'{direction}: {analysis.token.symbol} {analysis.token.price_change_24h:+.1f}%',
            message=f"""
{direction} ALERT!

Symbol: {analysis.token.symbol}
Price: ${analysis.token.price_usd:.8f}
24h Change: {analysis.token.price_change_24h:+.1f}%
Volume: ${analysis.token.volume_24h:,.0f}
Liquidity: ${analysis.token.liquidity_usd:,.0f}

Volume Activity: {analysis.volume_analysis['volume_rating']}
Price Momentum: {analysis.price_analysis['momentum']}
            """.strip(),
            data={
                'token': analysis.token.symbol,
                'change_24h': analysis.token.price_change_24h
            }
        )
        await self.notify(notification)
        
    async def _notify_price_alert(self, alert: Dict[str, Any]):
        """Notify about price alert"""
        token = alert['token']
        
        notification = Notification(
            timestamp=datetime.utcnow(),
            type='price_alert',
            priority=alert['severity'],
            title=f"Price Alert: {token.symbol} - {alert['type']}",
            message=f"""
⚠️ PRICE ALERT

Type: {alert['type'].upper()}
Token: {token.symbol}
1h Change: {alert['change_1h']:+.1f}%
Current Price: ${token.price_usd:.8f}
            """.strip(),
            data=alert
        )
        await self.notify(notification)
        
    async def _notify_new_gems(self, new_gems: List[TokenAnalysis]):
        """Notify about new gems found"""
        if not new_gems:
            return
            
        gems_text = []
        for gem in new_gems[:5]:
            gems_text.append(f"""
• {gem.token.symbol}
  Price: ${gem.token.price_usd:.8f}
  Score: {gem.opportunity_score:.0f}/100
  Risk: {gem.risk_assessment['risk_level']}
  {gem.recommendation}
            """.strip())
            
        notification = Notification(
            timestamp=datetime.utcnow(),
            type='new_gems',
            priority='high',
            title=f'✨ {len(new_gems)} New Gems Found!',
            message=f"""
NEW HIGH-POTENTIAL TOKENS DISCOVERED

{chr(10).join(gems_text)}
            """.strip(),
            data={
                'gems_count': len(new_gems),
                'top_gem': new_gems[0].token.symbol if new_gems else None
            }
        )
        await self.notify(notification)
        
    def _format_hourly_summary(self, report: HourlyReport) -> str:
        """Format hourly report summary"""
        lines = []
        
        # Market overview
        lines.append(f"Market Sentiment: {report.market_summary['market_sentiment'].upper()}")
        lines.append(f"Tokens Analyzed: {report.market_summary['total_tokens_analyzed']}")
        lines.append(f"Total Volume: ${report.market_summary['total_volume_24h']:,.0f}")
        lines.append("")
        
        # Key findings
        lines.append("KEY FINDINGS:")
        lines.append(f"• Dust-like tokens: {len(report.dust_like_tokens)}")
        lines.append(f"• Priceless-like tokens: {len(report.priceless_like_tokens)}")
        lines.append(f"• New gems: {len(report.new_gems)}")
        lines.append(f"• Price alerts: {len(report.price_alerts)}")
        
        # Top opportunities
        all_opportunities = []
        for analysis in (report.dust_like_tokens + report.priceless_like_tokens + report.new_gems):
            if analysis.opportunity_score > 70:
                all_opportunities.append(analysis)
                
        all_opportunities.sort(key=lambda x: x.opportunity_score, reverse=True)
        
        if all_opportunities:
            lines.append("")
            lines.append("TOP OPPORTUNITIES:")
            for opp in all_opportunities[:3]:
                lines.append(f"• {opp.token.symbol} - Score: {opp.opportunity_score:.0f}/100")
                
        return '\n'.join(lines)