import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import json
import aiofiles
from dataclasses import dataclass, asdict
import logging

from dexscreener_api import DexScreenerAPI, TokenData
from token_similarity import TokenSimilarityDetector, SimilarityMetrics
from price_tracker import LivePriceTracker

logger = logging.getLogger(__name__)

@dataclass
class TokenAnalysis:
    timestamp: datetime
    token: TokenData
    category: str  # 'dust_like', 'priceless_like', 'trending', 'new_gem'
    similarity_score: float
    price_analysis: Dict[str, Any]
    volume_analysis: Dict[str, Any]
    risk_assessment: Dict[str, Any]
    opportunity_score: float
    recommendation: str
    
@dataclass
class HourlyReport:
    timestamp: datetime
    dust_like_tokens: List[TokenAnalysis]
    priceless_like_tokens: List[TokenAnalysis]
    trending_tokens: List[TokenAnalysis]
    new_gems: List[TokenAnalysis]
    top_gainers: List[TokenAnalysis]
    price_alerts: List[Dict[str, Any]]
    market_summary: Dict[str, Any]

class HourlyAnalyzer:
    def __init__(self, api: DexScreenerAPI, price_tracker: LivePriceTracker):
        self.api = api
        self.price_tracker = price_tracker
        self.similarity_detector = TokenSimilarityDetector()
        self.analysis_history: List[HourlyReport] = []
        self.is_running = False
        
    async def perform_hourly_analysis(self) -> HourlyReport:
        """Perform comprehensive hourly analysis"""
        logger.info("Starting hourly analysis...")
        
        # Gather data
        trending = await self.api.get_trending_tokens()
        new_pairs = await self.api.get_new_pairs(hours=4)
        gainers_losers = await self.api.get_gainers_losers()
        
        # Get DUST and PRICELESS current data for reference
        dust_data = await self.api.search_pairs("DUST")
        priceless_data = await self.api.search_pairs("PRICELESS")
        
        # Find similar tokens
        dust_like = []
        priceless_like = []
        
        # Add actual DUST token as first example if found
        if dust_data:
            dust_token = dust_data[0]
            dust_analysis = await self._create_token_analysis(dust_token, 'dust_reference', 1.0)
            dust_like.append(dust_analysis)
            
        # Add actual PRICELESS token as first example if found
        if priceless_data:
            priceless_token = priceless_data[0]
            priceless_analysis = await self._create_token_analysis(priceless_token, 'priceless_reference', 1.0)
            priceless_like.append(priceless_analysis)
        
        all_tokens = trending + new_pairs + gainers_losers['gainers']
        
        # Find DUST-like tokens
        dust_similar = self.similarity_detector.find_dust_like_tokens(all_tokens)
        for sim in dust_similar[:10]:  # Top 10
            analysis = await self._create_token_analysis(sim.token, 'dust_like', sim.similarity_score)
            dust_like.append(analysis)
            
        # Find PRICELESS-like tokens
        priceless_similar = self.similarity_detector.find_priceless_like_tokens(all_tokens)
        for sim in priceless_similar[:10]:  # Top 10
            analysis = await self._create_token_analysis(sim.token, 'priceless_like', sim.similarity_score)
            priceless_like.append(analysis)
            
        # Analyze trending tokens
        trending_analyzed = []
        for token in trending[:10]:
            analysis = await self._create_token_analysis(token, 'trending', 0.8)
            trending_analyzed.append(analysis)
            
        # Find new gems (high potential new tokens)
        new_gems = []
        for token in new_pairs:
            token_analysis = self.similarity_detector.analyze_token(token)
            if token_analysis['opportunity_score'] > 70:
                analysis = await self._create_token_analysis(token, 'new_gem', 
                                                           token_analysis['opportunity_score'] / 100)
                new_gems.append(analysis)
                
        # Top gainers analysis
        top_gainers_analyzed = []
        for token in gainers_losers['gainers'][:5]:
            analysis = await self._create_token_analysis(token, 'top_gainer', 0.9)
            top_gainers_analyzed.append(analysis)
            
        # Get price alerts
        price_alerts = self.price_tracker.get_alerts()
        
        # Market summary
        market_summary = self._create_market_summary(all_tokens, gainers_losers)
        
        report = HourlyReport(
            timestamp=datetime.utcnow(),
            dust_like_tokens=dust_like,
            priceless_like_tokens=priceless_like,
            trending_tokens=trending_analyzed,
            new_gems=new_gems,
            top_gainers=top_gainers_analyzed,
            price_alerts=price_alerts,
            market_summary=market_summary
        )
        
        self.analysis_history.append(report)
        return report
        
    async def _create_token_analysis(self, token: TokenData, category: str, 
                                   similarity_score: float) -> TokenAnalysis:
        """Create detailed token analysis"""
        detector_analysis = self.similarity_detector.analyze_token(token)
        
        # Price analysis
        price_analysis = {
            'current_price': token.price_usd,
            'change_24h': token.price_change_24h,
            'momentum': detector_analysis['price_momentum']['momentum'],
            'price_tier': self._get_price_tier(token.price_usd)
        }
        
        # Volume analysis
        volume_analysis = {
            'volume_24h': token.volume_24h,
            'volume_to_mcap': detector_analysis['volume_activity']['ratio'],
            'volume_rating': detector_analysis['volume_activity']['rating'],
            'liquidity_health': detector_analysis['liquidity_health']['health']
        }
        
        # Risk assessment
        risk_assessment = {
            'risk_level': detector_analysis['risk_level'],
            'liquidity_risk': 'high' if token.liquidity_usd < 50_000 else 'medium' if token.liquidity_usd < 100_000 else 'low',
            'volatility_risk': 'high' if abs(token.price_change_24h) > 50 else 'medium' if abs(token.price_change_24h) > 25 else 'low',
            'age_risk': await self._assess_age_risk(token)
        }
        
        # Calculate opportunity score
        opportunity_score = detector_analysis['opportunity_score']
        
        # Generate recommendation
        recommendation = self._generate_recommendation(opportunity_score, risk_assessment, category)
        
        return TokenAnalysis(
            timestamp=datetime.utcnow(),
            token=token,
            category=category,
            similarity_score=similarity_score,
            price_analysis=price_analysis,
            volume_analysis=volume_analysis,
            risk_assessment=risk_assessment,
            opportunity_score=opportunity_score,
            recommendation=recommendation
        )
        
    def _get_price_tier(self, price: float) -> str:
        if price < 0.00001:
            return 'ultra_micro'
        elif price < 0.0001:
            return 'micro'
        elif price < 0.001:
            return 'mini'
        elif price < 0.01:
            return 'small'
        elif price < 0.1:
            return 'medium'
        elif price < 1:
            return 'large'
        else:
            return 'mega'
            
    async def _assess_age_risk(self, token: TokenData) -> str:
        try:
            created_at = datetime.fromisoformat(token.created_at.replace('Z', '+00:00'))
            age_hours = (datetime.utcnow() - created_at).total_seconds() / 3600
            
            if age_hours < 1:
                return 'extreme'
            elif age_hours < 24:
                return 'high'
            elif age_hours < 72:
                return 'medium'
            else:
                return 'low'
        except:
            return 'unknown'
            
    def _generate_recommendation(self, opportunity_score: float, 
                               risk_assessment: Dict[str, str], 
                               category: str) -> str:
        # Count high risks
        high_risks = sum(1 for risk in risk_assessment.values() if risk in ['high', 'extreme'])
        
        if opportunity_score >= 80 and high_risks <= 1:
            return "Strong Buy - High opportunity with manageable risk"
        elif opportunity_score >= 70 and high_risks <= 2:
            return "Buy - Good opportunity, monitor closely"
        elif opportunity_score >= 60 and high_risks <= 2:
            return "Consider - Moderate opportunity, research further"
        elif opportunity_score >= 50:
            return "Watch - Potential opportunity developing"
        elif high_risks >= 3:
            return "Avoid - High risk outweighs potential"
        else:
            return "Pass - Better opportunities available"
            
    def _create_market_summary(self, all_tokens: List[TokenData], 
                             gainers_losers: Dict[str, List[TokenData]]) -> Dict[str, Any]:
        """Create market summary statistics"""
        total_volume = sum(t.volume_24h for t in all_tokens)
        avg_price_change = sum(t.price_change_24h for t in all_tokens) / len(all_tokens) if all_tokens else 0
        
        # Count tokens by market cap tier
        mcap_tiers = {
            'nano': 0,
            'micro': 0,
            'small': 0,
            'mid': 0,
            'large': 0
        }
        
        for token in all_tokens:
            tier = self.similarity_detector._get_mcap_tier(token.market_cap)
            if tier in mcap_tiers:
                mcap_tiers[tier] += 1
                
        return {
            'timestamp': datetime.utcnow().isoformat(),
            'total_tokens_analyzed': len(all_tokens),
            'total_volume_24h': total_volume,
            'average_price_change': avg_price_change,
            'top_gainers_count': len(gainers_losers.get('gainers', [])),
            'top_losers_count': len(gainers_losers.get('losers', [])),
            'market_cap_distribution': mcap_tiers,
            'market_sentiment': 'bullish' if avg_price_change > 10 else 'neutral' if avg_price_change > -10 else 'bearish'
        }
        
    async def save_report(self, report: HourlyReport, filename: str):
        """Save analysis report to file"""
        report_dict = {
            'timestamp': report.timestamp.isoformat(),
            'dust_like_tokens': [self._analysis_to_dict(a) for a in report.dust_like_tokens],
            'priceless_like_tokens': [self._analysis_to_dict(a) for a in report.priceless_like_tokens],
            'trending_tokens': [self._analysis_to_dict(a) for a in report.trending_tokens],
            'new_gems': [self._analysis_to_dict(a) for a in report.new_gems],
            'top_gainers': [self._analysis_to_dict(a) for a in report.top_gainers],
            'price_alerts': report.price_alerts,
            'market_summary': report.market_summary
        }
        
        async with aiofiles.open(filename, 'w') as f:
            await f.write(json.dumps(report_dict, indent=2))
            
    def _analysis_to_dict(self, analysis: TokenAnalysis) -> Dict:
        """Convert TokenAnalysis to dictionary"""
        return {
            'timestamp': analysis.timestamp.isoformat(),
            'token': asdict(analysis.token),
            'category': analysis.category,
            'similarity_score': analysis.similarity_score,
            'price_analysis': analysis.price_analysis,
            'volume_analysis': analysis.volume_analysis,
            'risk_assessment': analysis.risk_assessment,
            'opportunity_score': analysis.opportunity_score,
            'recommendation': analysis.recommendation
        }
        
    def format_report_summary(self, report: HourlyReport) -> str:
        """Format report for display"""
        lines = []
        lines.append(f"\n{'='*60}")
        lines.append(f"HOURLY CRYPTO ANALYSIS REPORT")
        lines.append(f"Generated: {report.timestamp.strftime('%Y-%m-%d %H:%M UTC')}")
        lines.append(f"{'='*60}\n")
        
        # Market Summary
        lines.append("📊 MARKET SUMMARY")
        lines.append(f"Sentiment: {report.market_summary['market_sentiment'].upper()}")
        lines.append(f"Avg Price Change: {report.market_summary['average_price_change']:.2f}%")
        lines.append(f"Total Volume: ${report.market_summary['total_volume_24h']:,.0f}\n")
        
        # DUST-like tokens
        if report.dust_like_tokens:
            lines.append("🌪️  DUST-LIKE TOKENS")
            for i, analysis in enumerate(report.dust_like_tokens[:6]):
                token = analysis.token
                if i == 0 and analysis.category == 'dust_reference':
                    lines.append(f"📌 REFERENCE: {token.symbol} - ${token.price_usd:.8f}")
                else:
                    lines.append(f"• {token.symbol} - ${token.price_usd:.8f}")
                lines.append(f"  24h: {token.price_change_24h:+.1f}% | MCap: ${token.market_cap:,.0f}")
                lines.append(f"  Vol/MCap: {token.volume_24h / (token.market_cap + 1):.2f} | Liq: ${token.liquidity_usd:,.0f}")
                lines.append(f"  {analysis.recommendation}")
                lines.append("")
                
        # PRICELESS-like tokens
        if report.priceless_like_tokens:
            lines.append("💎 PRICELESS-LIKE TOKENS")
            for i, analysis in enumerate(report.priceless_like_tokens[:6]):
                token = analysis.token
                if i == 0 and analysis.category == 'priceless_reference':
                    lines.append(f"📌 REFERENCE: {token.symbol} - ${token.price_usd:.8f}")
                else:
                    lines.append(f"• {token.symbol} - ${token.price_usd:.8f}")
                lines.append(f"  24h: {token.price_change_24h:+.1f}% | MCap: ${token.market_cap:,.0f}")
                lines.append(f"  Vol/MCap: {token.volume_24h / (token.market_cap + 1):.2f} | Liq: ${token.liquidity_usd:,.0f}")
                lines.append(f"  {analysis.recommendation}")
                lines.append("")
                
        # New Gems
        if report.new_gems:
            lines.append("✨ NEW GEMS")
            for analysis in report.new_gems[:5]:
                token = analysis.token
                lines.append(f"• {token.symbol} - ${token.price_usd:.8f}")
                lines.append(f"  Score: {analysis.opportunity_score:.0f}/100 | Risk: {analysis.risk_assessment['risk_level']}")
                lines.append(f"  {analysis.recommendation}")
                lines.append("")
                
        # Price Alerts
        if report.price_alerts:
            lines.append("🚨 PRICE ALERTS")
            for alert in report.price_alerts[:5]:
                token = alert['token']
                lines.append(f"• {alert['type'].upper()} - {token.symbol}")
                lines.append(f"  1h Change: {alert['change_1h']:+.1f}%")
                lines.append("")
                
        return '\n'.join(lines)