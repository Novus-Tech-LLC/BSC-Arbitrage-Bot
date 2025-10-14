import { Token } from '../types';
import chalk from 'chalk';
import axios from 'axios';

interface DeepNarrativeAnalysis {
  token: Token;
  narrativeScore: number; // 0-100
  viralPotential: 'explosive' | 'high' | 'medium' | 'low';
  primaryNarrative: string;
  secondaryNarratives: string[];
  keyMetrics: {
    volumeMCRatio: number;
    holderGrowth: string;
    socialMomentum: string;
    memeability: number; // 0-10
    firstMoverAdvantage: boolean;
  };
  redFlags: string[];
  bullishSignals: string[];
  investmentThesis: string;
  riskLevel: 'extreme' | 'high' | 'medium' | 'low';
  expectedMultiple: string; // e.g., "10-50x", "100x+"
  timeHorizon: string; // e.g., "24-48h", "1 week"
  deployer?: {
    reputation: string;
    previousSuccesses: string[];
  };
}

export class AdvancedNarrativeAI {
  // Enhanced narrative patterns based on successful memecoins
  private narrativePatterns = {
    binanceConnection: {
      keywords: ['binance', 'bnb', 'cz', 'changpeng', 'zhao', 'bsc', 'chain'],
      score: 40,
      type: 'Binance Ecosystem',
      multiplier: 2 // Double score for BSC
    },
    elonMusk: {
      keywords: ['elon', 'musk', 'tesla', 'spacex', 'doge', 'twitter', 'x'],
      score: 35,
      type: 'Elon/Tech Influencer'
    },
    philosophicalMeme: {
      keywords: ['priceless', 'valuable', 'meaning', 'existence', 'reality', 'truth'],
      score: 30,
      type: 'Philosophical/Existential'
    },
    mythology: {
      keywords: ['god', 'odin', 'thor', 'zeus', 'apollo', 'titan', 'olympus'],
      score: 25,
      type: 'Mythology/Power'
    },
    internetCulture: {
      keywords: ['pepe', 'wojak', 'chad', 'based', 'kek', 'wagmi', 'ngmi', 'gm'],
      score: 30,
      type: 'Internet Native Meme'
    },
    animalMeme: {
      keywords: ['dog', 'cat', 'inu', 'shiba', 'floki', 'hamster', 'frog'],
      score: 20,
      type: 'Animal Meme'
    },
    cryptoCulture: {
      keywords: ['hodl', 'moon', 'lambo', 'diamond', 'hands', 'ape', 'degen'],
      score: 25,
      type: 'Crypto Native'
    },
    aiNarrative: {
      keywords: ['ai', 'gpt', 'bot', 'neural', 'quantum', 'singularity'],
      score: 30,
      type: 'AI/Tech Trend'
    },
    scarcity: {
      keywords: ['burn', 'deflationary', 'limited', 'rare', 'last', 'only'],
      score: 20,
      type: 'Scarcity Play'
    },
    redemption: {
      keywords: ['2.0', 'reborn', 'phoenix', 'comeback', 'revival', 'community'],
      score: 25,
      type: 'Redemption Arc'
    }
  };

  async performDeepAnalysis(token: Token): Promise<DeepNarrativeAnalysis> {
    console.log(chalk.cyan(`🧠 Performing deep AI analysis for ${token.symbol}...`));

    // Calculate narrative scores
    const narratives = this.identifyNarratives(token);
    const primaryNarrative = narratives[0]?.type || 'Unknown';
    const narrativeScore = this.calculateNarrativeScore(token, narratives);
    
    // Analyze market metrics
    const metrics = this.analyzeMarketMetrics(token);
    
    // Identify signals
    const { bullishSignals, redFlags } = this.identifySignals(token, metrics);
    
    // Determine viral potential
    const viralPotential = this.assessViralPotential(narrativeScore, metrics, bullishSignals.length, redFlags.length);
    
    // Generate investment thesis
    const thesis = this.generateInvestmentThesis(token, narratives, metrics, viralPotential);
    
    // Calculate risk and returns
    const { riskLevel, expectedMultiple, timeHorizon } = this.assessRiskReturn(token, metrics, viralPotential);

    const analysis: DeepNarrativeAnalysis = {
      token,
      narrativeScore,
      viralPotential,
      primaryNarrative,
      secondaryNarratives: narratives.slice(1).map(n => n.type),
      keyMetrics: metrics,
      redFlags,
      bullishSignals,
      investmentThesis: thesis,
      riskLevel,
      expectedMultiple,
      timeHorizon
    };

    this.logDeepAnalysis(analysis);
    return analysis;
  }

  private identifyNarratives(token: Token): Array<{type: string, score: number}> {
    const tokenText = `${token.name} ${token.symbol}`.toLowerCase();
    const identifiedNarratives: Array<{type: string, score: number}> = [];

    for (const [pattern, config] of Object.entries(this.narrativePatterns)) {
      const matches = config.keywords.filter(keyword => tokenText.includes(keyword));
      if (matches.length > 0) {
        let score = config.score;
        
        // BSC multiplier for Binance-related narratives
        if (pattern === 'binanceConnection' && token.chainId === 'bsc') {
          score *= 1.5; // Apply 1.5x multiplier for BSC tokens
        }
        
        identifiedNarratives.push({
          type: config.type,
          score: score * matches.length
        });
      }
    }

    return identifiedNarratives.sort((a, b) => b.score - a.score);
  }

  private calculateNarrativeScore(token: Token, narratives: Array<{type: string, score: number}>): number {
    let score = narratives.reduce((sum, n) => sum + n.score, 0);

    // Market momentum bonus
    if (token.priceChange24h > 100) score += 20;
    else if (token.priceChange24h > 50) score += 15;
    else if (token.priceChange24h > 20) score += 10;

    // Volume bonus
    if (token.volume24h > 1000000) score += 20;
    else if (token.volume24h > 500000) score += 15;
    else if (token.volume24h > 100000) score += 10;
    else if (token.volume24h > 50000) score += 5;

    // Low cap bonus (more upside potential)
    if (token.fdv < 100000) score += 20;
    else if (token.fdv < 500000) score += 15;
    else if (token.fdv < 1000000) score += 10;

    // Fresh token bonus
    if (this.isNewToken(token)) score += 15;

    return Math.min(score, 100);
  }

  private analyzeMarketMetrics(token: Token): DeepNarrativeAnalysis['keyMetrics'] {
    const volumeMCRatio = token.fdv > 0 ? token.volume24h / token.fdv : 0;
    
    return {
      volumeMCRatio,
      holderGrowth: this.assessHolderGrowth(token),
      socialMomentum: this.assessSocialMomentum(token),
      memeability: this.assessMemeability(token),
      firstMoverAdvantage: this.hasFirstMoverAdvantage(token)
    };
  }

  private identifySignals(token: Token, metrics: DeepNarrativeAnalysis['keyMetrics']): 
    { bullishSignals: string[], redFlags: string[] } {
    
    const bullishSignals: string[] = [];
    const redFlags: string[] = [];

    // Bullish signals
    if (metrics.volumeMCRatio > 0.5) bullishSignals.push('High volume/MC ratio (strong interest)');
    if (token.priceChange24h > 50) bullishSignals.push('Strong momentum (+50% in 24h)');
    if (token.liquidity > 10000) bullishSignals.push('Adequate liquidity for trading');
    if (metrics.firstMoverAdvantage) bullishSignals.push('First mover in narrative category');
    if (metrics.memeability >= 7) bullishSignals.push('High meme potential');
    if (token.fdv < 500000) bullishSignals.push('Low cap with high upside');

    // Red flags
    if (token.liquidity < 5000) redFlags.push('Low liquidity (rug risk)');
    if (metrics.volumeMCRatio < 0.1) redFlags.push('Low relative volume');
    if (token.priceChange24h < -20) redFlags.push('Negative momentum');
    if (!token.website) redFlags.push('No website/social presence');

    return { bullishSignals, redFlags };
  }

  private assessViralPotential(
    narrativeScore: number, 
    metrics: DeepNarrativeAnalysis['keyMetrics'],
    bullishCount: number,
    redFlagCount: number
  ): DeepNarrativeAnalysis['viralPotential'] {
    
    const totalScore = narrativeScore + 
      (metrics.memeability * 5) + 
      (bullishCount * 10) - 
      (redFlagCount * 15);

    if (totalScore >= 90) return 'explosive';
    if (totalScore >= 70) return 'high';
    if (totalScore >= 50) return 'medium';
    return 'low';
  }

  private generateInvestmentThesis(
    token: Token,
    narratives: Array<{type: string, score: number}>,
    metrics: DeepNarrativeAnalysis['keyMetrics'],
    viralPotential: string
  ): string {
    
    const primaryNarrative = narratives[0]?.type || 'Unknown';
    const volumeStrength = metrics.volumeMCRatio > 0.5 ? 'strong' : 'moderate';
    
    if (viralPotential === 'explosive') {
      return `${token.symbol} presents an explosive opportunity with ${primaryNarrative} narrative. ` +
        `${volumeStrength} volume indicates growing interest. High memeability score suggests viral spread potential. ` +
        `Entry at ${token.fdv < 500000 ? 'sub-500k' : 'current'} market cap offers significant upside.`;
    } else if (viralPotential === 'high') {
      return `${token.symbol} shows high potential with ${primaryNarrative} narrative gaining traction. ` +
        `Volume metrics are ${volumeStrength}, suggesting accumulation phase. ` +
        `Risk/reward favorable for speculative position.`;
    } else {
      return `${token.symbol} represents a speculative play on ${primaryNarrative} narrative. ` +
        `Limited viral indicators suggest cautious approach. Small position sizing recommended.`;
    }
  }

  private assessRiskReturn(
    token: Token,
    metrics: DeepNarrativeAnalysis['keyMetrics'],
    viralPotential: string
  ): { riskLevel: DeepNarrativeAnalysis['riskLevel'], expectedMultiple: string, timeHorizon: string } {
    
    let riskLevel: DeepNarrativeAnalysis['riskLevel'] = 'medium';
    let expectedMultiple = '5-10x';
    let timeHorizon = '3-7 days';

    // Risk assessment
    if (token.liquidity < 5000) riskLevel = 'extreme';
    else if (token.liquidity < 20000) riskLevel = 'high';
    else if (token.liquidity > 50000) riskLevel = 'low';

    // Return assessment based on viral potential and market cap
    if (viralPotential === 'explosive' && token.fdv < 100000) {
      expectedMultiple = '100x+';
      timeHorizon = '24-48h';
    } else if (viralPotential === 'explosive' && token.fdv < 500000) {
      expectedMultiple = '50-100x';
      timeHorizon = '2-5 days';
    } else if (viralPotential === 'high' && token.fdv < 500000) {
      expectedMultiple = '20-50x';
      timeHorizon = '3-7 days';
    } else if (viralPotential === 'high') {
      expectedMultiple = '10-20x';
      timeHorizon = '1 week';
    }

    return { riskLevel, expectedMultiple, timeHorizon };
  }

  // Helper methods
  private isNewToken(token: Token): boolean {
    // Simple heuristic - low liquidity often means new
    return token.liquidity < 50000;
  }

  private assessHolderGrowth(token: Token): string {
    // In real implementation, would track holder count over time
    if (token.volume24h > 100000) return 'Rapid growth';
    if (token.volume24h > 50000) return 'Steady growth';
    return 'Slow growth';
  }

  private assessSocialMomentum(token: Token): string {
    // In real implementation, would check Twitter/Telegram activity
    if (token.priceChange24h > 100) return 'Viral spreading';
    if (token.priceChange24h > 50) return 'Growing buzz';
    if (token.priceChange24h > 20) return 'Early momentum';
    return 'Low activity';
  }

  private assessMemeability(token: Token): number {
    let score = 5; // Base score
    const name = token.name.toLowerCase();
    const symbol = token.symbol.toLowerCase();

    // Bonus for meme-friendly names
    if (name.includes('pepe') || name.includes('doge')) score += 3;
    if (name.includes('moon') || name.includes('rocket')) score += 2;
    if (symbol.length <= 4) score += 1; // Short symbols are memorable
    if (name.includes('inu') || name.includes('shiba')) score += 2;
    
    // Philosophical/existential bonus
    if (name.includes('priceless') || name.includes('dust')) score += 2;
    
    return Math.min(score, 10);
  }

  private hasFirstMoverAdvantage(token: Token): boolean {
    // Check if it's first in its narrative category
    // In real implementation, would compare against other tokens
    return token.name.toLowerCase().includes('first') || 
           token.name.toLowerCase().includes('original') ||
           token.liquidity < 20000; // Early = potential first mover
  }

  private logDeepAnalysis(analysis: DeepNarrativeAnalysis) {
    const viralEmoji = {
      'explosive': '🚀🚀🚀',
      'high': '🔥🔥',
      'medium': '📈',
      'low': '⚠️'
    };

    const riskEmoji = {
      'extreme': '☠️',
      'high': '⚠️',
      'medium': '📊',
      'low': '✅'
    };

    console.log(chalk.yellow(`
╔═══════════════════════════════════════════════════════════════╗
║                    DEEP NARRATIVE ANALYSIS                     ║
╠═══════════════════════════════════════════════════════════════╣
║ Token: ${analysis.token.symbol} (${analysis.token.name})
║ Chain: ${analysis.token.chainId.toUpperCase()}
║ 
║ 🎯 NARRATIVE SCORE: ${analysis.narrativeScore}/100 ${viralEmoji[analysis.viralPotential]}
║ 📖 Primary Narrative: ${analysis.primaryNarrative}
║ 📚 Secondary: ${analysis.secondaryNarratives.join(', ') || 'None'}
║ 
║ 📊 KEY METRICS:
║ • Volume/MC Ratio: ${analysis.keyMetrics.volumeMCRatio.toFixed(2)}
║ • Holder Growth: ${analysis.keyMetrics.holderGrowth}
║ • Social Momentum: ${analysis.keyMetrics.socialMomentum}
║ • Memeability: ${analysis.keyMetrics.memeability}/10
║ • First Mover: ${analysis.keyMetrics.firstMoverAdvantage ? 'YES ✅' : 'NO ❌'}
║ 
║ 🟢 BULLISH SIGNALS (${analysis.bullishSignals.length}):
${analysis.bullishSignals.map(s => '║ • ' + s).join('\n')}
║ 
║ 🔴 RED FLAGS (${analysis.redFlags.length}):
${analysis.redFlags.map(s => '║ • ' + s).join('\n') || '║ • None identified'}
║ 
║ 💡 INVESTMENT THESIS:
║ ${analysis.investmentThesis.split('. ').join('\n║ ')}
║ 
║ 📈 EXPECTED RETURNS: ${analysis.expectedMultiple}
║ ⏰ TIME HORIZON: ${analysis.timeHorizon}
║ ${riskEmoji[analysis.riskLevel]} RISK LEVEL: ${analysis.riskLevel.toUpperCase()}
║ 
║ 💰 CURRENT PRICE: $${analysis.token.priceUsd}
║ 📊 MARKET CAP: $${analysis.token.fdv.toLocaleString()}
║ 💧 LIQUIDITY: $${analysis.token.liquidity.toLocaleString()}
║ 📈 24H CHANGE: ${analysis.token.priceChange24h > 0 ? '+' : ''}${analysis.token.priceChange24h.toFixed(2)}%
╚═══════════════════════════════════════════════════════════════╝
    `));

    // Special alerts for explosive opportunities
    if (analysis.viralPotential === 'explosive') {
      console.log(chalk.bgRed.white.bold(`
🚨🚨🚨 EXPLOSIVE OPPORTUNITY DETECTED 🚨🚨🚨
This token shows all signs of potential viral explosion!
Consider immediate entry with appropriate risk management.
      `));
    }
  }
}