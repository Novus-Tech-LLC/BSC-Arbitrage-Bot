import { Token } from '../types';
import chalk from 'chalk';
import axios from 'axios';

interface NarrativeScore {
  token: Token;
  score: number; // 0-100
  reasons: string[];
  viralPotential: 'low' | 'medium' | 'high' | 'explosive';
  narrativeType: string;
}

export class NarrativeAnalyzer {
  // Key narrative patterns that tend to pump
  private narrativePatterns = {
    celebrityConnection: {
      keywords: ['elon', 'musk', 'cz', 'binance', 'vitalik', 'trump', 'biden'],
      score: 30,
      type: 'Celebrity/Influencer'
    },
    emotionalAppeal: {
      keywords: ['save', 'help', 'charity', 'dogs', 'cats', 'baby', 'family'],
      score: 20,
      type: 'Emotional'
    },
    culturalMeme: {
      keywords: ['pepe', 'doge', 'shiba', 'wojak', 'chad', 'based', 'wagmi'],
      score: 25,
      type: 'Meme Culture'
    },
    scarcityNarrative: {
      keywords: ['burn', 'deflationary', 'limited', 'rare', 'scarce', 'only'],
      score: 20,
      type: 'Scarcity'
    },
    utilityPromise: {
      keywords: ['ai', 'gpt', 'defi', 'gamefi', 'metaverse', 'nft', 'dao'],
      score: 15,
      type: 'Utility'
    },
    communityPower: {
      keywords: ['community', 'army', 'together', 'movement', 'revolution'],
      score: 20,
      type: 'Community'
    },
    timingNarrative: {
      keywords: ['first', 'original', 'new', 'next', 'future', '2.0', '3.0'],
      score: 15,
      type: 'First Mover'
    }
  };

  async analyzeToken(token: Token): Promise<NarrativeScore> {
    console.log(chalk.cyan(`🤖 Analyzing narrative for ${token.symbol}...`));
    
    let totalScore = 0;
    const reasons: string[] = [];
    let strongestNarrative = '';
    let highestNarrativeScore = 0;

    // Analyze token name and symbol
    const tokenText = `${token.name} ${token.symbol}`.toLowerCase();

    // Check each narrative pattern
    for (const [pattern, config] of Object.entries(this.narrativePatterns)) {
      const patternScore = this.checkPattern(tokenText, config);
      if (patternScore > 0) {
        totalScore += patternScore;
        reasons.push(`${config.type}: +${patternScore} points`);
        
        if (patternScore > highestNarrativeScore) {
          highestNarrativeScore = patternScore;
          strongestNarrative = config.type;
        }
      }
    }

    // Market metrics boost
    if (token.priceChange24h > 50) {
      totalScore += 15;
      reasons.push('Strong momentum: +15 points');
    }

    if (token.volume24h > 1000000) {
      totalScore += 10;
      reasons.push('High volume: +10 points');
    }

    if (token.liquidity < 100000) {
      totalScore += 10;
      reasons.push('Low cap gem potential: +10 points');
    }

    // Fresh token boost
    const isNewToken = await this.checkIfNewToken(token);
    if (isNewToken) {
      totalScore += 20;
      reasons.push('Fresh launch: +20 points');
    }

    // Determine viral potential
    let viralPotential: 'low' | 'medium' | 'high' | 'explosive';
    if (totalScore >= 80) {
      viralPotential = 'explosive';
    } else if (totalScore >= 60) {
      viralPotential = 'high';
    } else if (totalScore >= 40) {
      viralPotential = 'medium';
    } else {
      viralPotential = 'low';
    }

    const result = {
      token,
      score: Math.min(totalScore, 100),
      reasons,
      viralPotential,
      narrativeType: strongestNarrative || 'Unknown'
    };

    this.logAnalysis(result);
    return result;
  }

  private checkPattern(text: string, config: any): number {
    const matchCount = config.keywords.filter((keyword: string) => 
      text.includes(keyword)
    ).length;
    
    return matchCount > 0 ? config.score : 0;
  }

  private async checkIfNewToken(token: Token): Promise<boolean> {
    // Consider tokens less than 7 days old as "new"
    // In real implementation, would check contract creation date
    return token.liquidity < 50000; // Simple heuristic for demo
  }

  async analyzeTrendingTokens(tokens: Token[]): Promise<NarrativeScore[]> {
    console.log(chalk.yellow('🔍 Analyzing narratives for trending tokens...'));
    
    const analyses = await Promise.all(
      tokens.map(token => this.analyzeToken(token))
    );

    // Sort by score
    return analyses.sort((a, b) => b.score - a.score);
  }

  getBestNarrativePicks(analyses: NarrativeScore[], limit: number = 3): NarrativeScore[] {
    return analyses
      .filter(a => a.viralPotential === 'explosive' || a.viralPotential === 'high')
      .slice(0, limit);
  }

  private logAnalysis(analysis: NarrativeScore) {
    const viralEmoji = {
      'explosive': '🚀',
      'high': '🔥',
      'medium': '📈',
      'low': '📉'
    };

    console.log(chalk.green(`
${viralEmoji[analysis.viralPotential]} ${analysis.token.symbol} Narrative Analysis:
Score: ${analysis.score}/100
Viral Potential: ${analysis.viralPotential.toUpperCase()}
Type: ${analysis.narrativeType}
Reasons: ${analysis.reasons.join(', ')}
    `));
  }

  // Specific pattern checkers for known successful narratives
  checkDustPattern(token: Token): boolean {
    // DUST succeeded because of CZ/Binance connection
    const text = token.name.toLowerCase();
    return text.includes('dust') || text.includes('clean') || text.includes('binance');
  }

  checkPricelessPattern(token: Token): boolean {
    // Philosophical/existential narratives
    const text = token.name.toLowerCase();
    return text.includes('priceless') || text.includes('valuable') || text.includes('worth');
  }

  checkOdinPattern(token: Token): boolean {
    // Mythology/power narratives
    const text = token.name.toLowerCase();
    return text.includes('god') || text.includes('odin') || text.includes('thor') || 
           text.includes('zeus') || text.includes('titan');
  }

  // Determine holding strategy based on narrative strength and market conditions
  determineStrategy(token: Token, narrativeScore: number, viralPotential: string): {
    strategy: 'scalp' | 'swing' | 'hold';
    targetHoldTime: number;
    narrativeStrength: 'weak' | 'medium' | 'strong' | 'viral';
    reasoning: string;
  } {
    // Determine narrative strength
    let narrativeStrength: 'weak' | 'medium' | 'strong' | 'viral';
    if (viralPotential === 'explosive' && narrativeScore >= 80) {
      narrativeStrength = 'viral';
    } else if (narrativeScore >= 60) {
      narrativeStrength = 'strong';
    } else if (narrativeScore >= 40) {
      narrativeStrength = 'medium';
    } else {
      narrativeStrength = 'weak';
    }

    // Strong AI/Tech narratives = longer holds
    const isAITech = token.name.toLowerCase().includes('ai') || 
                     token.name.toLowerCase().includes('gpt') ||
                     token.name.toLowerCase().includes('bot');
    
    // Binance/Exchange narratives = medium-long holds
    const isBinanceEcosystem = token.name.toLowerCase().includes('bnb') ||
                               token.name.toLowerCase().includes('binance') ||
                               token.name.toLowerCase().includes('cz');

    // Redemption narratives (2.0, 3.0 etc) = swing trades
    const isRedemptionArc = token.name.includes('2.0') || 
                            token.name.includes('3.0') ||
                            token.name.toLowerCase().includes('reborn');

    // Pure pump plays = scalps
    const isPumpPlay = token.priceChange24h > 200 && token.volume24h / token.fdv > 0.5;

    let strategy: 'scalp' | 'swing' | 'hold';
    let targetHoldTime: number;
    let reasoning: string;

    if (narrativeStrength === 'viral' && (isAITech || isBinanceEcosystem)) {
      // Strongest narratives with ecosystem support = long holds
      strategy = 'hold';
      targetHoldTime = 72 + (Math.random() * 48); // 3-5 days
      reasoning = 'Viral narrative with strong ecosystem alignment - hold for maximum gains';
    } else if (narrativeStrength === 'strong' && !isPumpPlay) {
      // Strong narratives without pump characteristics = swing trades
      strategy = 'swing';
      targetHoldTime = 24 + (Math.random() * 24); // 1-2 days
      reasoning = 'Strong narrative momentum - swing trade the trend';
    } else if (isPumpPlay || narrativeScore < 40) {
      // Weak narratives or obvious pumps = quick scalps
      strategy = 'scalp';
      targetHoldTime = 2 + (Math.random() * 6); // 2-8 hours
      reasoning = isPumpPlay ? 'High volume pump - take profits quickly' : 'Weak narrative - exit on any pump';
    } else if (isRedemptionArc && narrativeStrength === 'medium') {
      // Redemption plays with medium strength = swing
      strategy = 'swing';
      targetHoldTime = 12 + (Math.random() * 36); // 12-48 hours
      reasoning = 'Redemption narrative building momentum - ride the wave';
    } else {
      // Default to swing for medium narratives
      strategy = 'swing';
      targetHoldTime = 24;
      reasoning = 'Standard narrative play - monitor for developments';
    }

    return {
      strategy,
      targetHoldTime: Math.round(targetHoldTime),
      narrativeStrength,
      reasoning
    };
  }
}