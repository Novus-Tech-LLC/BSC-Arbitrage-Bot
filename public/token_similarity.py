import numpy as np
from typing import List, Dict, Tuple, Any
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity
import pandas as pd
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging

from dexscreener_api import TokenData

logger = logging.getLogger(__name__)

@dataclass
class SimilarityMetrics:
    token: TokenData
    similarity_score: float
    matching_features: Dict[str, float]
    analysis: Dict[str, str]

class TokenSimilarityDetector:
    def __init__(self):
        self.scaler = StandardScaler()
        self.reference_tokens = {
            'DUST': {
                'market_cap_range': (1_000_000, 50_000_000),
                'volume_to_mcap_ratio': (0.5, 3.0),
                'price_volatility': 'high',
                'liquidity_threshold': 100_000,
                'age_hours': (1, 168)  # 1 hour to 1 week
            },
            'PRICELESS': {
                'market_cap_range': (500_000, 20_000_000),
                'volume_to_mcap_ratio': (1.0, 5.0),
                'price_volatility': 'very_high',
                'liquidity_threshold': 50_000,
                'age_hours': (0.5, 72)  # 30 min to 3 days
            }
        }
        
    def extract_features(self, token: TokenData) -> np.ndarray:
        """Extract numerical features from token data"""
        features = []
        
        # Market metrics
        features.append(np.log10(token.market_cap + 1))
        features.append(np.log10(token.volume_24h + 1))
        features.append(np.log10(token.liquidity_usd + 1))
        
        # Ratios
        volume_to_mcap = token.volume_24h / (token.market_cap + 1)
        features.append(volume_to_mcap)
        
        liquidity_to_mcap = token.liquidity_usd / (token.market_cap + 1)
        features.append(liquidity_to_mcap)
        
        # Price metrics
        features.append(token.price_change_24h)
        features.append(abs(token.price_change_24h))  # Volatility proxy
        
        # Age (if available)
        try:
            created_at = datetime.fromisoformat(token.created_at.replace('Z', '+00:00'))
            age_hours = (datetime.utcnow() - created_at).total_seconds() / 3600
            features.append(np.log10(age_hours + 1))
        except:
            features.append(0)
            
        return np.array(features)
        
    def calculate_similarity(self, token1: TokenData, token2: TokenData) -> float:
        """Calculate cosine similarity between two tokens"""
        features1 = self.extract_features(token1).reshape(1, -1)
        features2 = self.extract_features(token2).reshape(1, -1)
        
        # Normalize features
        all_features = np.vstack([features1, features2])
        normalized = self.scaler.fit_transform(all_features)
        
        return cosine_similarity(normalized[0:1], normalized[1:2])[0][0]
        
    def analyze_token(self, token: TokenData) -> Dict[str, Any]:
        """Comprehensive token analysis"""
        analysis = {
            'market_cap_tier': self._get_mcap_tier(token.market_cap),
            'volume_activity': self._analyze_volume(token),
            'liquidity_health': self._analyze_liquidity(token),
            'price_momentum': self._analyze_price_action(token),
            'risk_level': self._calculate_risk(token),
            'opportunity_score': self._calculate_opportunity(token)
        }
        
        return analysis
        
    def _get_mcap_tier(self, market_cap: float) -> str:
        if market_cap < 100_000:
            return 'nano'
        elif market_cap < 1_000_000:
            return 'micro'
        elif market_cap < 10_000_000:
            return 'small'
        elif market_cap < 100_000_000:
            return 'mid'
        else:
            return 'large'
            
    def _analyze_volume(self, token: TokenData) -> Dict[str, Any]:
        volume_to_mcap = token.volume_24h / (token.market_cap + 1)
        
        return {
            'ratio': volume_to_mcap,
            'rating': 'very_high' if volume_to_mcap > 2 else 
                     'high' if volume_to_mcap > 1 else
                     'moderate' if volume_to_mcap > 0.5 else
                     'low' if volume_to_mcap > 0.1 else 'very_low',
            'dollar_volume': token.volume_24h
        }
        
    def _analyze_liquidity(self, token: TokenData) -> Dict[str, Any]:
        liq_to_mcap = token.liquidity_usd / (token.market_cap + 1)
        
        return {
            'liquidity_usd': token.liquidity_usd,
            'ratio': liq_to_mcap,
            'health': 'excellent' if liq_to_mcap > 0.5 else
                     'good' if liq_to_mcap > 0.2 else
                     'fair' if liq_to_mcap > 0.1 else
                     'poor' if liq_to_mcap > 0.05 else 'critical'
        }
        
    def _analyze_price_action(self, token: TokenData) -> Dict[str, Any]:
        change_24h = token.price_change_24h
        
        return {
            'change_24h': change_24h,
            'momentum': 'explosive' if change_24h > 100 else
                       'strong_bullish' if change_24h > 50 else
                       'bullish' if change_24h > 20 else
                       'mild_bullish' if change_24h > 5 else
                       'neutral' if abs(change_24h) <= 5 else
                       'mild_bearish' if change_24h > -20 else
                       'bearish' if change_24h > -50 else 'strong_bearish'
        }
        
    def _calculate_risk(self, token: TokenData) -> str:
        risk_factors = 0
        
        # Low liquidity
        if token.liquidity_usd < 50_000:
            risk_factors += 2
        elif token.liquidity_usd < 100_000:
            risk_factors += 1
            
        # High volatility
        if abs(token.price_change_24h) > 50:
            risk_factors += 1
            
        # New token
        try:
            created_at = datetime.fromisoformat(token.created_at.replace('Z', '+00:00'))
            age_hours = (datetime.utcnow() - created_at).total_seconds() / 3600
            if age_hours < 24:
                risk_factors += 2
            elif age_hours < 72:
                risk_factors += 1
        except:
            risk_factors += 1
            
        # Low market cap
        if token.market_cap < 1_000_000:
            risk_factors += 1
            
        if risk_factors >= 4:
            return 'extreme'
        elif risk_factors >= 3:
            return 'high'
        elif risk_factors >= 2:
            return 'moderate'
        else:
            return 'low'
            
    def _calculate_opportunity(self, token: TokenData) -> float:
        """Score 0-100 based on potential opportunity"""
        score = 0
        
        # Volume activity (30 points)
        volume_ratio = token.volume_24h / (token.market_cap + 1)
        if volume_ratio > 2:
            score += 30
        elif volume_ratio > 1:
            score += 20
        elif volume_ratio > 0.5:
            score += 10
            
        # Price momentum (20 points)
        if 20 <= token.price_change_24h <= 100:
            score += 20
        elif 10 <= token.price_change_24h < 20:
            score += 15
        elif 5 <= token.price_change_24h < 10:
            score += 10
            
        # Liquidity health (20 points)
        if token.liquidity_usd > 200_000:
            score += 20
        elif token.liquidity_usd > 100_000:
            score += 15
        elif token.liquidity_usd > 50_000:
            score += 10
            
        # Market cap sweet spot (30 points)
        if 1_000_000 <= token.market_cap <= 10_000_000:
            score += 30
        elif 500_000 <= token.market_cap < 1_000_000:
            score += 20
        elif 10_000_000 < token.market_cap <= 50_000_000:
            score += 15
            
        return min(score, 100)
        
    def find_similar_tokens(self, reference_token: TokenData, 
                          candidates: List[TokenData], 
                          top_k: int = 10) -> List[SimilarityMetrics]:
        """Find tokens similar to reference token"""
        results = []
        
        for candidate in candidates:
            if candidate.address == reference_token.address:
                continue
                
            similarity = self.calculate_similarity(reference_token, candidate)
            analysis = self.analyze_token(candidate)
            
            # Feature matching
            matching_features = {
                'market_cap_tier': 1.0 if self._get_mcap_tier(candidate.market_cap) == 
                                         self._get_mcap_tier(reference_token.market_cap) else 0.5,
                'volume_activity': 1.0 - abs(candidate.volume_24h / (candidate.market_cap + 1) - 
                                           reference_token.volume_24h / (reference_token.market_cap + 1)) / 2,
                'price_momentum': 1.0 - abs(candidate.price_change_24h - reference_token.price_change_24h) / 100
            }
            
            results.append(SimilarityMetrics(
                token=candidate,
                similarity_score=similarity,
                matching_features=matching_features,
                analysis=analysis
            ))
            
        # Sort by similarity score
        results.sort(key=lambda x: x.similarity_score, reverse=True)
        return results[:top_k]
        
    def find_dust_like_tokens(self, candidates: List[TokenData]) -> List[SimilarityMetrics]:
        """Find tokens matching DUST profile"""
        dust_profile = self.reference_tokens['DUST']
        filtered = []
        
        for token in candidates:
            # Check market cap range
            if not (dust_profile['market_cap_range'][0] <= token.market_cap <= dust_profile['market_cap_range'][1]):
                continue
                
            # Check volume ratio
            volume_ratio = token.volume_24h / (token.market_cap + 1)
            if not (dust_profile['volume_to_mcap_ratio'][0] <= volume_ratio <= dust_profile['volume_to_mcap_ratio'][1]):
                continue
                
            # Check liquidity
            if token.liquidity_usd < dust_profile['liquidity_threshold']:
                continue
                
            analysis = self.analyze_token(token)
            
            filtered.append(SimilarityMetrics(
                token=token,
                similarity_score=analysis['opportunity_score'] / 100,
                matching_features={
                    'market_cap_match': 1.0,
                    'volume_ratio_match': 1.0,
                    'liquidity_match': 1.0
                },
                analysis=analysis
            ))
            
        filtered.sort(key=lambda x: x.similarity_score, reverse=True)
        return filtered
        
    def find_priceless_like_tokens(self, candidates: List[TokenData]) -> List[SimilarityMetrics]:
        """Find tokens matching PRICELESS profile"""
        priceless_profile = self.reference_tokens['PRICELESS']
        filtered = []
        
        for token in candidates:
            # Check market cap range
            if not (priceless_profile['market_cap_range'][0] <= token.market_cap <= priceless_profile['market_cap_range'][1]):
                continue
                
            # Check volume ratio
            volume_ratio = token.volume_24h / (token.market_cap + 1)
            if not (priceless_profile['volume_to_mcap_ratio'][0] <= volume_ratio <= priceless_profile['volume_to_mcap_ratio'][1]):
                continue
                
            # Check liquidity
            if token.liquidity_usd < priceless_profile['liquidity_threshold']:
                continue
                
            analysis = self.analyze_token(token)
            
            filtered.append(SimilarityMetrics(
                token=token,
                similarity_score=analysis['opportunity_score'] / 100,
                matching_features={
                    'market_cap_match': 1.0,
                    'volume_ratio_match': 1.0,
                    'liquidity_match': 1.0
                },
                analysis=analysis
            ))
            
        filtered.sort(key=lambda x: x.similarity_score, reverse=True)
        return filtered