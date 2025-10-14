import asyncio
from typing import Dict, List, Optional, Callable
from datetime import datetime, timedelta
from collections import defaultdict
import json
import aiofiles
import logging
from dataclasses import dataclass, field, asdict

from dexscreener_api import DexScreenerAPI, TokenData

logger = logging.getLogger(__name__)

@dataclass
class PricePoint:
    timestamp: datetime
    price: float
    volume: float
    liquidity: float
    market_cap: float
    
@dataclass
class PriceHistory:
    token: TokenData
    price_points: List[PricePoint] = field(default_factory=list)
    
    def add_point(self, point: PricePoint):
        self.price_points.append(point)
        # Keep only last 24 hours of data
        cutoff = datetime.utcnow() - timedelta(hours=24)
        self.price_points = [p for p in self.price_points if p.timestamp > cutoff]
        
    def get_price_change(self, hours: int = 1) -> Optional[float]:
        if len(self.price_points) < 2:
            return None
            
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        old_points = [p for p in self.price_points if p.timestamp <= cutoff]
        
        if not old_points:
            return None
            
        old_price = old_points[-1].price
        current_price = self.price_points[-1].price
        
        if old_price == 0:
            return None
            
        return ((current_price - old_price) / old_price) * 100
        
    def get_volume_trend(self, hours: int = 1) -> str:
        """Analyze volume trend over specified hours"""
        if len(self.price_points) < 2:
            return 'insufficient_data'
            
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        recent_points = [p for p in self.price_points if p.timestamp > cutoff]
        
        if len(recent_points) < 2:
            return 'insufficient_data'
            
        # Calculate average volume for first half and second half
        mid_point = len(recent_points) // 2
        first_half_avg = sum(p.volume for p in recent_points[:mid_point]) / mid_point
        second_half_avg = sum(p.volume for p in recent_points[mid_point:]) / len(recent_points[mid_point:])
        
        ratio = second_half_avg / (first_half_avg + 1)
        
        if ratio > 1.5:
            return 'increasing'
        elif ratio < 0.7:
            return 'decreasing'
        else:
            return 'stable'

class LivePriceTracker:
    def __init__(self, api: DexScreenerAPI):
        self.api = api
        self.tracked_tokens: Dict[str, PriceHistory] = {}
        self.update_callbacks: List[Callable] = []
        self.tracking_interval = 300  # 5 minutes
        self.is_running = False
        
    def add_token(self, token: TokenData):
        """Add a token to track"""
        if token.address not in self.tracked_tokens:
            self.tracked_tokens[token.address] = PriceHistory(token=token)
            logger.info(f"Added {token.symbol} to price tracking")
            
    def remove_token(self, address: str):
        """Remove a token from tracking"""
        if address in self.tracked_tokens:
            del self.tracked_tokens[address]
            
    def register_callback(self, callback: Callable):
        """Register callback for price updates"""
        self.update_callbacks.append(callback)
        
    async def update_prices(self):
        """Update prices for all tracked tokens"""
        updates = {}
        
        for address, history in self.tracked_tokens.items():
            try:
                # Get latest data for the token
                token_data = await self.api.get_token_pairs(address)
                
                if token_data:
                    # Use the first pair (usually highest liquidity)
                    latest = token_data[0]
                    
                    # Create price point
                    price_point = PricePoint(
                        timestamp=datetime.utcnow(),
                        price=latest.price_usd,
                        volume=latest.volume_24h,
                        liquidity=latest.liquidity_usd,
                        market_cap=latest.market_cap
                    )
                    
                    history.add_point(price_point)
                    history.token = latest  # Update token data
                    
                    updates[address] = {
                        'token': latest,
                        'price_change_1h': history.get_price_change(1),
                        'price_change_4h': history.get_price_change(4),
                        'price_change_24h': history.get_price_change(24),
                        'volume_trend': history.get_volume_trend(1)
                    }
                    
            except Exception as e:
                logger.error(f"Error updating {address}: {e}")
                
        # Notify callbacks
        for callback in self.update_callbacks:
            await callback(updates)
            
        return updates
        
    async def start_tracking(self):
        """Start the price tracking loop"""
        self.is_running = True
        logger.info("Started price tracking")
        
        while self.is_running:
            try:
                await self.update_prices()
                await asyncio.sleep(self.tracking_interval)
            except Exception as e:
                logger.error(f"Tracking error: {e}")
                await asyncio.sleep(60)  # Wait before retry
                
    def stop_tracking(self):
        """Stop the price tracking loop"""
        self.is_running = False
        
    async def save_history(self, filename: str):
        """Save price history to file"""
        data = {}
        
        for address, history in self.tracked_tokens.items():
            data[address] = {
                'token': asdict(history.token),
                'price_points': [
                    {
                        'timestamp': p.timestamp.isoformat(),
                        'price': p.price,
                        'volume': p.volume,
                        'liquidity': p.liquidity,
                        'market_cap': p.market_cap
                    }
                    for p in history.price_points
                ]
            }
            
        async with aiofiles.open(filename, 'w') as f:
            await f.write(json.dumps(data, indent=2))
            
    def get_tracked_summary(self) -> List[Dict]:
        """Get summary of all tracked tokens"""
        summaries = []
        
        for address, history in self.tracked_tokens.items():
            if not history.price_points:
                continue
                
            current_price = history.price_points[-1].price
            summary = {
                'token': history.token,
                'current_price': current_price,
                'price_change_1h': history.get_price_change(1),
                'price_change_4h': history.get_price_change(4),
                'price_change_24h': history.get_price_change(24),
                'volume_trend': history.get_volume_trend(1),
                'last_update': history.price_points[-1].timestamp
            }
            summaries.append(summary)
            
        return summaries
        
    def get_alerts(self) -> List[Dict]:
        """Get price alerts for significant movements"""
        alerts = []
        
        for address, history in self.tracked_tokens.items():
            change_1h = history.get_price_change(1)
            
            if change_1h is None:
                continue
                
            # Alert for large price movements
            if abs(change_1h) > 20:
                alert_type = 'pump' if change_1h > 0 else 'dump'
                alerts.append({
                    'type': alert_type,
                    'token': history.token,
                    'change_1h': change_1h,
                    'severity': 'high' if abs(change_1h) > 50 else 'medium'
                })
                
            # Alert for volume spikes
            volume_trend = history.get_volume_trend(1)
            if volume_trend == 'increasing' and change_1h and change_1h > 10:
                alerts.append({
                    'type': 'volume_spike',
                    'token': history.token,
                    'change_1h': change_1h,
                    'severity': 'medium'
                })
                
        return alerts