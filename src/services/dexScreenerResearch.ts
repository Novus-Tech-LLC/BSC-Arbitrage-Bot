import axios from 'axios';
import chalk from 'chalk';
import { ClaudeAIService } from './claudeAI';

interface VolumeBlastCoin {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  priceUsd: string;
  volume24h: number;
  volumeChange24h: number;
  priceChange24h: number;
  marketCap: number;
  liquidity: number;
  createdAt: number;
  txns24h: {
    buys: number;
    sells: number;
  };
  pairAddress: string;
  dexScreenerUrl: string;
}

interface ResearchReport {
  coin: VolumeBlastCoin;
  timestamp: Date;
  volumeMultiple: number; // How many X volume increased
  narrative: string;
  entryZones: {
    price: number;
    reasoning: string;
  }[];
  risks: string[];
  catalysts: string[];
  similarToHistoricalPumps: string[]; // Similar to DUST, PRICELESS, etc
  claudeAnalysis?: any;
}

export class DexScreenerResearch {
  private researchHistory: ResearchReport[] = [];
  private claudeAI: ClaudeAIService;
  private isActive: boolean = false;

  constructor() {
    this.claudeAI = new ClaudeAIService();
  }

  async findVolumeBlasts(): Promise<VolumeBlastCoin[]> {
    console.log(chalk.cyan('🔍 Searching DexScreener for volume blast coins...'));
    
    try {
      // Get BSC tokens from DexScreener
      const response = await axios.get('https://api.dexscreener.com/latest/dex/search', {
        params: {
          q: 'bsc'
        }
      });

      const tokens = response.data.pairs || [];
      
      // Filter for volume blasts similar to DUST, PRICELESS
      const volumeBlasts = tokens
        .filter((token: any) => {
          // Must be BSC
          if (!token.chainId || !token.chainId.toLowerCase().includes('bsc')) return false;
          
          // Volume filters - looking for explosive growth
          const volume24h = parseFloat(token.volume?.h24 || 0);
          const volumeChange = parseFloat(token.volume?.h24Change || 0);
          const marketCap = parseFloat(token.fdv || 0);
          
          // Look for coins with:
          // - Minimum $50k daily volume
          // - Volume increased by at least 300% (3x)
          // - Market cap under $10M (early stage)
          // - Volume/MC ratio > 0.5 (high activity)
          return volume24h > 50000 && 
                 volumeChange > 300 &&
                 marketCap < 10000000 &&
                 marketCap > 0 &&
                 (volume24h / marketCap) > 0.5;
        })
        .map((token: any) => ({
          symbol: token.baseToken.symbol,
          name: token.baseToken.name,
          address: token.baseToken.address,
          chain: token.chainId,
          priceUsd: token.priceUsd,
          volume24h: parseFloat(token.volume?.h24 || 0),
          volumeChange24h: parseFloat(token.volume?.h24Change || 0),
          priceChange24h: parseFloat(token.priceChange?.h24 || 0),
          marketCap: parseFloat(token.fdv || 0),
          liquidity: parseFloat(token.liquidity?.usd || 0),
          createdAt: token.pairCreatedAt || 0,
          txns24h: {
            buys: token.txns?.h24?.buys || 0,
            sells: token.txns?.h24?.sells || 0
          },
          pairAddress: token.pairAddress,
          dexScreenerUrl: `https://dexscreener.com/bsc/${token.pairAddress}`
        }))
        .sort((a: VolumeBlastCoin, b: VolumeBlastCoin) => b.volumeChange24h - a.volumeChange24h)
        .slice(0, 10); // Top 10 volume blasts

      console.log(chalk.green(`🚀 Found ${volumeBlasts.length} volume blast coins!`));
      return volumeBlasts;

    } catch (error) {
      console.error(chalk.red('❌ Error fetching volume blasts:'), error);
      return [];
    }
  }

  async researchCoin(coin: VolumeBlastCoin): Promise<ResearchReport> {
    console.log(chalk.cyan(`📊 Researching ${coin.symbol}...`));
    
    // Calculate volume multiple
    const volumeMultiple = coin.volumeChange24h / 100;
    
    // Analyze buy/sell ratio
    const buyRatio = coin.txns24h.buys / (coin.txns24h.buys + coin.txns24h.sells);
    const sellPressure = buyRatio < 0.4 ? 'HIGH' : buyRatio < 0.5 ? 'MODERATE' : 'LOW';
    
    // Determine if it's similar to historical pumps
    const historicalSimilarities: string[] = [];
    
    // DUST pattern: 2x volume/MC ratio, CZ narrative
    if (coin.volume24h / coin.marketCap > 2) {
      historicalSimilarities.push('DUST (2x volume/MC wash trading pattern)');
    }
    
    // PRICELESS pattern: New coin, instant volume
    const ageInDays = (Date.now() - coin.createdAt) / (1000 * 60 * 60 * 24);
    if (ageInDays < 2 && coin.volume24h > 100000) {
      historicalSimilarities.push('PRICELESS (new coin instant volume)');
    }
    
    // Generate narrative based on name/symbol
    let narrative = this.generateNarrative(coin);
    
    // Calculate entry zones
    const currentPrice = parseFloat(coin.priceUsd);
    const entryZones = this.calculateEntryZones(coin, sellPressure);
    
    // Identify risks
    const risks = this.identifyRisks(coin, volumeMultiple, sellPressure);
    
    // Identify catalysts
    const catalysts = this.identifyCatalysts(coin, volumeMultiple);
    
    // Get Claude's opinion if available
    let claudeAnalysis;
    if (process.env.CLAUDE_API_KEY) {
      try {
        claudeAnalysis = await this.claudeAI.analyzeToken({
          symbol: coin.symbol,
          name: coin.name,
          address: coin.address,
          priceUsd: coin.priceUsd,
          fdv: coin.marketCap,
          volume24h: coin.volume24h,
          priceChange24h: coin.priceChange24h,
          liquidity: coin.liquidity,
          logo: '',
          chainId: 'bsc'
        } as any);
      } catch (error) {
        console.error(chalk.yellow('⚠️ Claude analysis failed:', error));
      }
    }
    
    const report: ResearchReport = {
      coin,
      timestamp: new Date(),
      volumeMultiple,
      narrative,
      entryZones,
      risks,
      catalysts,
      similarToHistoricalPumps: historicalSimilarities,
      claudeAnalysis
    };
    
    this.researchHistory.push(report);
    this.logResearchReport(report);
    
    return report;
  }

  private generateNarrative(coin: VolumeBlastCoin): string {
    const symbol = coin.symbol.toUpperCase();
    const name = coin.name.toUpperCase();
    
    // Check for known narrative patterns
    if (name.includes('BINANCE') || name.includes('BSC') || symbol.includes('CZ')) {
      return `CZ/Binance narrative play. With CZ's return approaching, any Binance-related token sees massive speculation. Volume surge indicates smart money accumulation.`;
    }
    
    if (name.includes('AI') || name.includes('GPT') || name.includes('NEURAL')) {
      return `AI narrative following ChatGPT/tech trends. Retail loves AI tokens during tech market pumps. Volume spike shows narrative is catching fire.`;
    }
    
    if (name.includes('PEPE') || name.includes('WOJAK') || name.includes('MEME')) {
      return `Classic meme revival play. When memes pump on ETH, BSC follows with cheaper alternatives. Volume explosion = degen apes rotating profits.`;
    }
    
    if (name.includes('DRAGON') || name.includes('YEAR')) {
      return `Chinese New Year narrative (Year of Dragon 2024). Cultural tokens pump hard during celebrations. Volume shows Asian market waking up.`;
    }
    
    // Generic narrative based on volume
    const volumeMultiple = coin.volumeChange24h / 100;
    return `Stealth launch gaining massive traction. ${volumeMultiple.toFixed(1)}x volume increase signals either insider accumulation or community discovering hidden gem. Classic BSC degen play.`;
  }

  private calculateEntryZones(coin: VolumeBlastCoin, sellPressure: string): { price: number; reasoning: string }[] {
    const currentPrice = parseFloat(coin.priceUsd);
    const zones = [];
    
    // Immediate entry if sell pressure is low and volume increasing
    if (sellPressure === 'LOW' && coin.priceChange24h > 0) {
      zones.push({
        price: currentPrice,
        reasoning: 'Momentum entry - Low sell pressure + rising price'
      });
    }
    
    // Retracement entries
    zones.push({
      price: currentPrice * 0.85,
      reasoning: '15% pullback entry - Natural profit taking zone'
    });
    
    zones.push({
      price: currentPrice * 0.75,
      reasoning: '25% pullback entry - Weak hands shakeout complete'
    });
    
    // Breakout entry
    if (coin.priceChange24h > 50) {
      zones.push({
        price: currentPrice * 1.1,
        reasoning: 'Breakout confirmation - New ATH momentum play'
      });
    }
    
    return zones;
  }

  private identifyRisks(coin: VolumeBlastCoin, volumeMultiple: number, sellPressure: string): string[] {
    const risks = [];
    
    // Wash trading risk
    if (coin.volume24h / coin.marketCap > 3) {
      risks.push('🚨 EXTREME wash trading detected (>3x volume/MC ratio)');
    } else if (coin.volume24h / coin.marketCap > 1.5) {
      risks.push('⚠️ High wash trading probability (>1.5x volume/MC)');
    }
    
    // Liquidity risk
    if (coin.liquidity < 50000) {
      risks.push('💧 Low liquidity - large sells will nuke price');
    }
    
    // Age risk
    const ageInDays = (Date.now() - coin.createdAt) / (1000 * 60 * 60 * 24);
    if (ageInDays < 1) {
      risks.push('🆕 Brand new token - rug risk elevated');
    }
    
    // Sell pressure risk
    if (sellPressure === 'HIGH') {
      risks.push('📉 Heavy sell pressure - insiders may be exiting');
    }
    
    // Pump phase risk
    if (coin.priceChange24h > 200) {
      risks.push('🎯 Already pumped 200%+ - late entry risk');
    }
    
    return risks;
  }

  private identifyCatalysts(coin: VolumeBlastCoin, volumeMultiple: number): string[] {
    const catalysts = [];
    
    // Volume catalyst
    if (volumeMultiple > 10) {
      catalysts.push(`📈 ${volumeMultiple.toFixed(0)}x volume explosion - massive attention incoming`);
    }
    
    // Price momentum
    if (coin.priceChange24h > 100) {
      catalysts.push('🚀 Parabolic price action attracting FOMO buyers');
    }
    
    // Market cap potential
    if (coin.marketCap < 1000000) {
      catalysts.push('💎 Sub $1M mcap - 10-100x potential if narrative holds');
    }
    
    // Time-based catalysts
    const hour = new Date().getHours();
    if (hour >= 2 && hour <= 6) { // 2 AM - 6 AM UTC
      catalysts.push('🌏 Asian market hours - BSC volume typically peaks');
    }
    
    return catalysts;
  }

  private logResearchReport(report: ResearchReport) {
    const { coin, volumeMultiple, narrative, entryZones, risks, catalysts, similarToHistoricalPumps } = report;
    
    console.log(chalk.yellow(`
╔════════════════════════════════════════════════════════════════════╗
║                    DEXSCREENER RESEARCH REPORT                      ║
╠════════════════════════════════════════════════════════════════════╣
║ 🪙 Token: ${coin.symbol} (${coin.name})
║ 📊 Address: ${coin.address.slice(0, 6)}...${coin.address.slice(-4)}
║ 🔗 DexScreener: ${coin.dexScreenerUrl}
║
║ 💹 METRICS:
║ • Price: $${parseFloat(coin.priceUsd).toFixed(8)}
║ • Market Cap: $${coin.marketCap.toLocaleString()}
║ • Volume 24h: $${coin.volume24h.toLocaleString()} (${coin.volumeChange24h > 0 ? '+' : ''}${coin.volumeChange24h.toFixed(0)}%)
║ • Volume Multiple: ${volumeMultiple.toFixed(1)}x
║ • Price Change: ${coin.priceChange24h > 0 ? '+' : ''}${coin.priceChange24h.toFixed(1)}%
║ • Buy/Sell Ratio: ${coin.txns24h.buys}/${coin.txns24h.sells}
║
║ 📖 NARRATIVE:
║ ${narrative}
║
║ 🎯 ENTRY ZONES:
${entryZones.map(zone => `║ • $${zone.price.toFixed(8)} - ${zone.reasoning}`).join('\n')}
║
║ ⚠️ RISKS:
${risks.map(risk => `║ ${risk}`).join('\n')}
║
║ 🚀 CATALYSTS:
${catalysts.map(catalyst => `║ ${catalyst}`).join('\n')}
║
║ 🔄 SIMILAR TO: ${similarToHistoricalPumps.join(', ') || 'None identified'}
╚════════════════════════════════════════════════════════════════════╝
    `));
    
    if (report.claudeAnalysis) {
      console.log(chalk.cyan('🤖 Claude AI Says:', report.claudeAnalysis.reasoning));
    }
  }

  async startHourlyResearch(callback: (reports: ResearchReport[]) => void) {
    this.isActive = true;
    console.log(chalk.green('📊 Started hourly DexScreener research'));
    
    const doResearch = async () => {
      if (!this.isActive) return;
      
      try {
        console.log(chalk.cyan('\n🔄 Running scheduled volume blast research...'));
        const volumeBlasts = await this.findVolumeBlasts();
        
        if (volumeBlasts.length > 0) {
          console.log(chalk.yellow(`\n🎯 Analyzing top ${Math.min(3, volumeBlasts.length)} volume blast coins...\n`));
          
          // Research top 3 coins
          const reports = [];
          for (const coin of volumeBlasts.slice(0, 3)) {
            const report = await this.researchCoin(coin);
            reports.push(report);
            await this.delay(2000); // Delay between researches
          }
          
          // Callback with new reports
          callback(reports);
        }
      } catch (error) {
        console.error(chalk.red('❌ Research error:'), error);
      }
      
      // Schedule next research in 1 hour
      if (this.isActive) {
        setTimeout(doResearch, 60 * 60 * 1000); // 1 hour
      }
    };
    
    // Start immediately
    doResearch();
  }

  stopResearch() {
    this.isActive = false;
    console.log(chalk.yellow('📊 Stopped DexScreener research'));
  }

  getResearchHistory(): ResearchReport[] {
    return this.researchHistory;
  }

  getLatestReports(count: number = 10): ResearchReport[] {
    return this.researchHistory.slice(-count);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}