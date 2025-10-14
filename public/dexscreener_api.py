import aiohttp
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import json
from dataclasses import dataclass, asdict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class TokenData:
    address: str
    symbol: str
    name: str
    price_usd: float
    price_change_24h: float
    volume_24h: float
    liquidity_usd: float
    market_cap: float
    fdv: float
    chain: str
    pair_address: str
    created_at: str
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TokenData':
        return cls(
            address=data.get('baseToken', {}).get('address', ''),
            symbol=data.get('baseToken', {}).get('symbol', ''),
            name=data.get('baseToken', {}).get('name', ''),
            price_usd=float(data.get('priceUsd', 0)),
            price_change_24h=float(data.get('priceChange', {}).get('h24', 0)),
            volume_24h=float(data.get('volume', {}).get('h24', 0)),
            liquidity_usd=float(data.get('liquidity', {}).get('usd', 0)),
            market_cap=float(data.get('marketCap', 0)),
            fdv=float(data.get('fdv', 0)),
            chain=data.get('chainId', ''),
            pair_address=data.get('pairAddress', ''),
            created_at=data.get('pairCreatedAt', '')
        )

class DexScreenerAPI:
    BASE_URL = "https://api.dexscreener.com/latest"
    
    def __init__(self):
        self.session = None
        self.rate_limit_delay = 1.0  # Delay between requests
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            
    async def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """Make HTTP request with rate limiting and error handling"""
        url = f"{self.BASE_URL}/{endpoint}"
        try:
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    await asyncio.sleep(self.rate_limit_delay)
                    return data
                else:
                    logger.error(f"API request failed: {response.status}")
                    return None
        except Exception as e:
            logger.error(f"Request error: {e}")
            return None
            
    async def search_pairs(self, query: str) -> List[TokenData]:
        """Search for token pairs by query"""
        data = await self._make_request(f"dex/search?q={query}")
        if data and 'pairs' in data:
            return [TokenData.from_dict(pair) for pair in data['pairs']]
        return []
        
    async def get_token_pairs(self, token_address: str) -> List[TokenData]:
        """Get all pairs for a specific token"""
        data = await self._make_request(f"dex/tokens/{token_address}")
        if data and 'pairs' in data:
            return [TokenData.from_dict(pair) for pair in data['pairs']]
        return []
        
    async def get_trending_tokens(self, chain: Optional[str] = None) -> List[TokenData]:
        """Get trending tokens, optionally filtered by chain"""
        endpoint = f"dex/tokens/trending"
        if chain:
            endpoint += f"/{chain}"
            
        data = await self._make_request(endpoint)
        if data:
            tokens = []
            # Handle different response formats
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and 'pairs' in item and item['pairs']:
                        tokens.append(TokenData.from_dict(item['pairs'][0]))
            elif isinstance(data, dict) and 'tokens' in data:
                for item in data['tokens']:
                    if isinstance(item, dict) and 'pairs' in item and item['pairs']:
                        tokens.append(TokenData.from_dict(item['pairs'][0]))
            return tokens
        return []
        
    async def get_pair_info(self, chain: str, pair_address: str) -> Optional[TokenData]:
        """Get detailed info for a specific pair"""
        data = await self._make_request(f"dex/pairs/{chain}/{pair_address}")
        if data and 'pair' in data:
            return TokenData.from_dict(data['pair'])
        return None
        
    async def get_new_pairs(self, chain: Optional[str] = None, hours: int = 24) -> List[TokenData]:
        """Get newly created pairs within specified hours"""
        endpoint = "dex/pairs/new"
        if chain:
            endpoint += f"/{chain}"
            
        data = await self._make_request(endpoint)
        if data and 'pairs' in data:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours)
            new_pairs = []
            
            for pair in data['pairs']:
                try:
                    created_at = datetime.fromisoformat(pair.get('pairCreatedAt', '').replace('Z', '+00:00'))
                    if created_at >= cutoff_time:
                        new_pairs.append(TokenData.from_dict(pair))
                except:
                    continue
                    
            return new_pairs
        return []
        
    async def get_gainers_losers(self, chain: Optional[str] = None) -> Dict[str, List[TokenData]]:
        """Get top gainers and losers"""
        endpoint = "dex/tokens/gainers-losers"
        if chain:
            endpoint += f"/{chain}"
            
        data = await self._make_request(endpoint)
        result = {'gainers': [], 'losers': []}
        
        if data:
            if 'gainers' in data:
                for item in data['gainers']:
                    if 'pairs' in item and item['pairs']:
                        result['gainers'].append(TokenData.from_dict(item['pairs'][0]))
                        
            if 'losers' in data:
                for item in data['losers']:
                    if 'pairs' in item and item['pairs']:
                        result['losers'].append(TokenData.from_dict(item['pairs'][0]))
                        
        return result