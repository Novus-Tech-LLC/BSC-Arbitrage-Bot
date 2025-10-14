import { Token } from '../types';
import chalk from 'chalk';
import axios from 'axios';

// Pump phase detection
export enum PumpPhase {
  ACCUMULATION = 'accumulation',
  INITIAL_PUMP = 'initial_pump',
  PEAK_FOMO = 'peak_fomo',
  DISTRIBUTION = 'distribution',
  DUMP = 'dump',
  DEAD = 'dead'
}

interface PumpAnalysis {
  token: Token;
  phase: PumpPhase;
  riskLevel: 'EXTREME' | 'VERY HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
  pumpScore: number; // 0-100
  volumeAnalysis: {
    volumeMCRatio: number;
    isWashTrading: boolean;
    organicVolumeEstimate: number;
    manipulationLevel: 'SEVERE' | 'HIGH' | 'MODERATE' | 'LOW' | 'NONE';
  };
  priceAction: {
    trend: 'PUMPING' | 'DUMPING' | 'VOLATILE' | 'STABLE';
    recentSwing: number;
    support: number;
    resistance: number;
    nextTarget: number;
  };
  narrative: {
    type: string;
    strength: 'VIRAL' | 'STRONG' | 'MODERATE' | 'WEAK';
    timeliness: 'PERFECT' | 'GOOD' | 'LATE' | 'DEAD';
  };
  socialSignals: {
    hasCoordinatedPump: boolean;
    telegramActivity: 'EXTREME' | 'HIGH' | 'MODERATE' | 'LOW';
    twitterMentions: number;
    influencerInvolvement: boolean;
  };
  entryAnalysis: {
    shouldEnter: boolean;
    entryZone: { min: number; max: number } | null;
    stopLoss: number | null;
    targets: number[];
    timeframe: string;
    strategy?: 'scalp' | 'swing' | 'hold' | 'avoid';
  };
  warnings: string[];
  insights: string[];
  detailedReport: string;
}

export class PumpDetectorAI {
  // Key patterns learned from DUST and other pumps
  private pumpPatterns = {
    volumeThresholds: {
      normal: 0.5,        // Volume < 50% of MC
      suspicious: 1.0,    // Volume = 100% of MC  
      manipulation: 1.5,  // Volume > 150% of MC
      severe: 2.0        // Volume > 200% of MC (like DUST)
    },
    priceActionPatterns: {
      accumulation: { volatility: 0.1, trend: 'sideways' },
      pump: { volatility: 0.3, trend: 'up', minGain: 0.5 },
      distribution: { volatility: 0.4, trend: 'volatile', swings: 0.3 },
      dump: { volatility: 0.2, trend: 'down', minLoss: -0.3 }
    },
    narrativeTimings: {
      cz_release: '2024-09-27',
      binance_news: 'ongoing',
      meme_cycles: 'weekly'
    }
  };

  async analyzePump(token: Token): Promise<PumpAnalysis> {
    console.log(chalk.cyan(`🔍 AI Pump Detector analyzing ${token.symbol}...`));

    // Core analysis components
    const volumeAnalysis = this.analyzeVolume(token);
    const priceAction = this.analyzePriceAction(token);
    const phase = this.detectPumpPhase(token, volumeAnalysis, priceAction);
    const narrative = this.analyzeNarrative(token);
    const socialSignals = await this.analyzeSocialSignals(token);
    const entryAnalysis = this.analyzeEntry(token, phase, volumeAnalysis);
    
    // Calculate overall pump score
    const pumpScore = this.calculatePumpScore(volumeAnalysis, priceAction, narrative, socialSignals);
    
    // Determine risk level
    const riskLevel = this.assessRisk(phase, volumeAnalysis, pumpScore);
    
    // Generate warnings and insights
    const { warnings, insights } = this.generateWarningsAndInsights(
      token, phase, volumeAnalysis, priceAction, narrative
    );
    
    // Create detailed report
    const detailedReport = this.generateDetailedReport(
      token, phase, volumeAnalysis, priceAction, narrative, socialSignals
    );

    const analysis: PumpAnalysis = {
      token,
      phase,
      riskLevel,
      pumpScore,
      volumeAnalysis,
      priceAction,
      narrative,
      socialSignals,
      entryAnalysis,
      warnings,
      insights,
      detailedReport
    };

    this.logAnalysis(analysis);
    return analysis;
  }

  private analyzeVolume(token: Token): PumpAnalysis['volumeAnalysis'] {
    const volumeMCRatio = token.fdv > 0 ? token.volume24h / token.fdv : 0;
    
    let isWashTrading = false;
    let manipulationLevel: PumpAnalysis['volumeAnalysis']['manipulationLevel'] = 'NONE';
    
    if (volumeMCRatio > this.pumpPatterns.volumeThresholds.severe) {
      isWashTrading = true;
      manipulationLevel = 'SEVERE';
    } else if (volumeMCRatio > this.pumpPatterns.volumeThresholds.manipulation) {
      isWashTrading = true;
      manipulationLevel = 'HIGH';
    } else if (volumeMCRatio > this.pumpPatterns.volumeThresholds.suspicious) {
      isWashTrading = true;
      manipulationLevel = 'MODERATE';
    } else if (volumeMCRatio > this.pumpPatterns.volumeThresholds.normal) {
      manipulationLevel = 'LOW';
    }

    // Estimate organic volume (learned from DUST case)
    const organicVolumeEstimate = isWashTrading 
      ? token.volume24h * 0.2  // Only 20% is real if wash trading
      : token.volume24h * 0.8; // 80% real if normal

    return {
      volumeMCRatio,
      isWashTrading,
      organicVolumeEstimate,
      manipulationLevel
    };
  }

  private analyzePriceAction(token: Token): PumpAnalysis['priceAction'] {
    const change24h = token.priceChange24h / 100;
    const currentPrice = parseFloat(token.priceUsd);
    
    let trend: PumpAnalysis['priceAction']['trend'] = 'STABLE';
    
    if (change24h > 0.5) {
      trend = 'PUMPING';
    } else if (change24h < -0.3) {
      trend = 'DUMPING';
    } else if (Math.abs(change24h) > 0.2) {
      trend = 'VOLATILE';
    }

    // Calculate support/resistance based on recent action
    const support = currentPrice * 0.7; // 30% below
    const resistance = currentPrice * 1.5; // 50% above
    const nextTarget = trend === 'PUMPING' ? resistance : support;

    return {
      trend,
      recentSwing: change24h,
      support,
      resistance,
      nextTarget
    };
  }

  private detectPumpPhase(
    token: Token, 
    volumeAnalysis: PumpAnalysis['volumeAnalysis'],
    priceAction: PumpAnalysis['priceAction']
  ): PumpPhase {
    
    // DUST-like patterns
    if (volumeAnalysis.volumeMCRatio > 2 && priceAction.trend === 'VOLATILE') {
      return PumpPhase.DISTRIBUTION; // Classic DUST distribution phase
    }
    
    if (volumeAnalysis.volumeMCRatio > 1.5 && priceAction.recentSwing > 0.5) {
      return PumpPhase.PEAK_FOMO;
    }
    
    if (priceAction.trend === 'PUMPING' && volumeAnalysis.volumeMCRatio > 0.5) {
      return PumpPhase.INITIAL_PUMP;
    }
    
    if (priceAction.trend === 'DUMPING' && priceAction.recentSwing < -0.3) {
      return PumpPhase.DUMP;
    }
    
    if (token.volume24h < 10000 && token.liquidity < 10000) {
      return PumpPhase.DEAD;
    }
    
    return PumpPhase.ACCUMULATION;
  }

  private analyzeNarrative(token: Token): PumpAnalysis['narrative'] {
    const name = token.name.toLowerCase();
    const symbol = token.symbol.toLowerCase();
    
    let type = 'Generic Meme';
    let strength: PumpAnalysis['narrative']['strength'] = 'WEAK';
    
    // Check for powerful narratives (learned from DUST)
    if (name.includes('dust') || name.includes('clean')) {
      type = 'Binance/CZ Cleaning';
      strength = 'STRONG';
    } else if (name.includes('cz') || name.includes('binance')) {
      type = 'CZ/Binance Direct';
      strength = 'VIRAL';
    } else if (name.includes('elon') || name.includes('doge')) {
      type = 'Elon/Doge';
      strength = 'STRONG';
    } else if (name.includes('pepe') || name.includes('wojak')) {
      type = 'Classic Meme';
      strength = 'MODERATE';
    }

    // Assess timeliness
    let timeliness: PumpAnalysis['narrative']['timeliness'] = 'LATE';
    if (token.liquidity < 100000 && strength !== 'WEAK') {
      timeliness = 'PERFECT'; // Early + good narrative
    } else if (token.liquidity < 500000) {
      timeliness = 'GOOD';
    }

    return { type, strength, timeliness };
  }

  private async analyzeSocialSignals(token: Token): Promise<PumpAnalysis['socialSignals']> {
    // In real implementation, would check actual social data
    // For now, using heuristics based on volume patterns
    
    const hasCoordinatedPump = token.volume24h / token.fdv > 1.5;
    const telegramActivity = hasCoordinatedPump ? 'HIGH' : 'LOW';
    const twitterMentions = Math.floor(token.volume24h / 100000); // Rough estimate
    const influencerInvolvement = token.volume24h > 1000000;

    return {
      hasCoordinatedPump,
      telegramActivity,
      twitterMentions,
      influencerInvolvement
    };
  }

  private analyzeEntry(
    token: Token,
    phase: PumpPhase,
    volumeAnalysis: PumpAnalysis['volumeAnalysis']
  ): PumpAnalysis['entryAnalysis'] {
    
    const currentPrice = parseFloat(token.priceUsd);
    
    // Never enter if severe manipulation or wrong phase
    if (volumeAnalysis.manipulationLevel === 'SEVERE' || 
        phase === PumpPhase.DISTRIBUTION || 
        phase === PumpPhase.DUMP ||
        phase === PumpPhase.DEAD) {
      return {
        shouldEnter: false,
        entryZone: null,
        stopLoss: null,
        targets: [],
        timeframe: 'DO NOT ENTER',
        strategy: 'avoid'
      };
    }

    // Determine strategy based on phase and narrative
    let strategy: 'scalp' | 'swing' | 'hold' = 'swing';
    let timeframe = '1-2 days';
    
    // Only consider entry in early phases
    if (phase === PumpPhase.ACCUMULATION || phase === PumpPhase.INITIAL_PUMP) {
      // Accumulation phase with strong narrative = potential hold
      if (phase === PumpPhase.ACCUMULATION && token.volume24h < 1000000) {
        strategy = 'hold';
        timeframe = '3-5 days (monitor for narrative development)';
      }
      // Initial pump with high volume = scalp opportunity
      else if (phase === PumpPhase.INITIAL_PUMP && volumeAnalysis.volumeMCRatio > 1) {
        strategy = 'scalp';
        timeframe = '2-8 hours (high volume pump)';
      }
      // Default to swing for moderate conditions
      else {
        strategy = 'swing';
        timeframe = '1-2 days (ride the wave)';
      }

      return {
        shouldEnter: true,
        entryZone: { 
          min: currentPrice * 0.95, 
          max: currentPrice * 1.05 
        },
        stopLoss: currentPrice * 0.8,
        targets: [
          currentPrice * 1.5,  // 50% gain
          currentPrice * 2,    // 100% gain
          currentPrice * 5     // 5x moonshot
        ],
        strategy,
        timeframe
      };
    }

    return {
      shouldEnter: false,
      entryZone: null,
      stopLoss: null,
      targets: [],
      timeframe: 'Too late - FOMO phase'
    };
  }

  private calculatePumpScore(
    volumeAnalysis: PumpAnalysis['volumeAnalysis'],
    priceAction: PumpAnalysis['priceAction'],
    narrative: PumpAnalysis['narrative'],
    socialSignals: PumpAnalysis['socialSignals']
  ): number {
    
    let score = 0;

    // Volume score (inverted - high manipulation = low score)
    if (volumeAnalysis.manipulationLevel === 'NONE') score += 20;
    else if (volumeAnalysis.manipulationLevel === 'LOW') score += 15;
    else if (volumeAnalysis.manipulationLevel === 'MODERATE') score += 10;
    else if (volumeAnalysis.manipulationLevel === 'HIGH') score += 5;
    
    // Price action score
    if (priceAction.trend === 'PUMPING') score += 25;
    else if (priceAction.trend === 'STABLE') score += 10;
    
    // Narrative score
    if (narrative.strength === 'VIRAL') score += 30;
    else if (narrative.strength === 'STRONG') score += 20;
    else if (narrative.strength === 'MODERATE') score += 10;
    
    // Timeliness bonus
    if (narrative.timeliness === 'PERFECT') score += 15;
    else if (narrative.timeliness === 'GOOD') score += 10;
    
    // Social signals
    if (socialSignals.influencerInvolvement) score += 10;

    return Math.min(score, 100);
  }

  private assessRisk(
    phase: PumpPhase,
    volumeAnalysis: PumpAnalysis['volumeAnalysis'],
    pumpScore: number
  ): PumpAnalysis['riskLevel'] {
    
    if (phase === PumpPhase.DISTRIBUTION || phase === PumpPhase.DUMP) {
      return 'EXTREME';
    }
    
    if (volumeAnalysis.manipulationLevel === 'SEVERE') {
      return 'EXTREME';
    }
    
    if (volumeAnalysis.manipulationLevel === 'HIGH' || phase === PumpPhase.PEAK_FOMO) {
      return 'VERY HIGH';
    }
    
    if (pumpScore < 30) {
      return 'HIGH';
    }
    
    if (pumpScore > 70 && phase === PumpPhase.ACCUMULATION) {
      return 'MEDIUM';
    }
    
    return 'HIGH';
  }

  private generateWarningsAndInsights(
    token: Token,
    phase: PumpPhase,
    volumeAnalysis: PumpAnalysis['volumeAnalysis'],
    priceAction: PumpAnalysis['priceAction'],
    narrative: PumpAnalysis['narrative']
  ): { warnings: string[], insights: string[] } {
    
    const warnings: string[] = [];
    const insights: string[] = [];

    // Volume warnings (DUST-style detection)
    if (volumeAnalysis.volumeMCRatio > 2) {
      warnings.push('🚨 SEVERE WASH TRADING DETECTED - Volume 2x+ market cap!');
    } else if (volumeAnalysis.volumeMCRatio > 1.5) {
      warnings.push('⚠️ High wash trading likely - Volume exceeds market cap');
    }

    // Phase warnings
    if (phase === PumpPhase.DISTRIBUTION) {
      warnings.push('💀 DISTRIBUTION PHASE - Insiders dumping on retail');
    } else if (phase === PumpPhase.PEAK_FOMO) {
      warnings.push('🔥 PEAK FOMO - High risk of imminent dump');
    }

    // Price action warnings
    if (Math.abs(priceAction.recentSwing) > 0.3) {
      warnings.push('🎢 Extreme volatility - Possible manipulation');
    }

    // Insights
    if (narrative.strength === 'VIRAL' && phase === PumpPhase.ACCUMULATION) {
      insights.push('💎 Viral narrative + early phase = Potential gem');
    }
    
    if (token.liquidity > 100000 && volumeAnalysis.manipulationLevel === 'NONE') {
      insights.push('✅ Healthy liquidity and organic volume');
    }

    if (narrative.type.includes('Binance') && token.chainId === 'bsc') {
      insights.push('🔗 BSC + Binance narrative = Strong combo');
    }

    return { warnings, insights };
  }

  private generateDetailedReport(
    token: Token,
    phase: PumpPhase,
    volumeAnalysis: PumpAnalysis['volumeAnalysis'],
    priceAction: PumpAnalysis['priceAction'],
    narrative: PumpAnalysis['narrative'],
    socialSignals: PumpAnalysis['socialSignals']
  ): string {
    
    return `
## 🔍 PUMP DETECTOR AI ANALYSIS: ${token.symbol}

### 📊 Current Status
- **Phase**: ${phase.toUpperCase()} ${this.getPhaseEmoji(phase)}
- **Price**: $${token.priceUsd} (${priceAction.recentSwing > 0 ? '+' : ''}${(priceAction.recentSwing * 100).toFixed(2)}%)
- **Market Cap**: $${token.fdv.toLocaleString()}
- **Volume**: $${token.volume24h.toLocaleString()}

### 🎯 Key Findings

**Volume Analysis** ${volumeAnalysis.isWashTrading ? '🚨' : '✅'}
- Volume/MC Ratio: ${volumeAnalysis.volumeMCRatio.toFixed(2)}x
- Manipulation Level: ${volumeAnalysis.manipulationLevel}
- Estimated Real Volume: $${volumeAnalysis.organicVolumeEstimate.toLocaleString()}

**Narrative Power** ${narrative.strength === 'VIRAL' ? '🔥' : '📖'}
- Type: ${narrative.type}
- Strength: ${narrative.strength}
- Timing: ${narrative.timeliness}

**Social Coordination** ${socialSignals.hasCoordinatedPump ? '🚨' : '👥'}
- Coordinated Pump: ${socialSignals.hasCoordinatedPump ? 'YES' : 'NO'}
- Telegram Activity: ${socialSignals.telegramActivity}
- Influencer Involvement: ${socialSignals.influencerInvolvement ? 'YES' : 'NO'}

### ${phase === PumpPhase.ACCUMULATION || phase === PumpPhase.INITIAL_PUMP ? '✅' : '❌'} Entry Recommendation
${this.getEntryRecommendation(phase, volumeAnalysis)}

### 📈 Price Targets
- Support: $${priceAction.support.toFixed(6)}
- Current: $${token.priceUsd}
- Resistance: $${priceAction.resistance.toFixed(6)}
- Next Target: $${priceAction.nextTarget.toFixed(6)}

### 💡 DUST-Style Pattern Recognition
${this.getDustPatternAnalysis(volumeAnalysis, priceAction, phase)}
    `;
  }

  private getPhaseEmoji(phase: PumpPhase): string {
    const emojis = {
      [PumpPhase.ACCUMULATION]: '🏗️',
      [PumpPhase.INITIAL_PUMP]: '🚀',
      [PumpPhase.PEAK_FOMO]: '🔥',
      [PumpPhase.DISTRIBUTION]: '💀',
      [PumpPhase.DUMP]: '📉',
      [PumpPhase.DEAD]: '⚰️'
    };
    return emojis[phase] || '❓';
  }

  private getEntryRecommendation(
    phase: PumpPhase, 
    volumeAnalysis: PumpAnalysis['volumeAnalysis']
  ): string {
    if (phase === PumpPhase.ACCUMULATION && volumeAnalysis.manipulationLevel !== 'SEVERE') {
      return '✅ EARLY ENTRY OPPORTUNITY - Low risk, high reward potential';
    } else if (phase === PumpPhase.INITIAL_PUMP && volumeAnalysis.volumeMCRatio < 1) {
      return '⚠️ RISKY ENTRY - Pump started but may continue';
    } else if (phase === PumpPhase.DISTRIBUTION) {
      return '🚨 DO NOT ENTER - You are exit liquidity!';
    } else {
      return '❌ NO ENTRY - Too late or too risky';
    }
  }

  private getDustPatternAnalysis(
    volumeAnalysis: PumpAnalysis['volumeAnalysis'],
    priceAction: PumpAnalysis['priceAction'],
    phase: PumpPhase
  ): string {
    if (volumeAnalysis.volumeMCRatio > 2 && phase === PumpPhase.DISTRIBUTION) {
      return `🎯 DUST PATTERN DETECTED! 
- Volume 2x+ market cap = Classic wash trading
- Volatile price swings = Distribution phase
- Recommendation: STAY AWAY - This is the dump phase`;
    }
    
    if (volumeAnalysis.volumeMCRatio > 1.5 && priceAction.trend === 'VOLATILE') {
      return `⚠️ DUST-LIKE BEHAVIOR EMERGING
- High volume/MC ratio developing
- Volatility increasing
- Watch for distribution signs`;
    }
    
    return `✅ No DUST-like manipulation detected (yet)`;
  }

  private logAnalysis(analysis: PumpAnalysis) {
    const riskEmoji = {
      'LOW': '🟢',
      'MEDIUM': '🟡',
      'HIGH': '🟠',
      'VERY HIGH': '🔴',
      'EXTREME': '☠️'
    };

    console.log(chalk.yellow(`
╔═══════════════════════════════════════════════════════════════╗
║                    🤖 AI PUMP DETECTOR REPORT                  ║
╠═══════════════════════════════════════════════════════════════╣
║ Token: ${analysis.token.symbol} (${analysis.token.name})
║ Phase: ${analysis.phase.toUpperCase()} ${this.getPhaseEmoji(analysis.phase)}
║ Risk: ${riskEmoji[analysis.riskLevel]} ${analysis.riskLevel}
║ Pump Score: ${analysis.pumpScore}/100
║ 
║ 🚨 WARNINGS (${analysis.warnings.length}):
${analysis.warnings.map(w => '║ ' + w).join('\n')}
║ 
║ 💡 INSIGHTS (${analysis.insights.length}):
${analysis.insights.map(i => '║ ' + i).join('\n')}
║ 
║ 📊 Should Enter: ${analysis.entryAnalysis.shouldEnter ? 'YES ✅' : 'NO ❌'}
╚═══════════════════════════════════════════════════════════════╝
    `));

    if (analysis.riskLevel === 'EXTREME') {
      console.log(chalk.bgRed.white.bold(`
⚠️ ⚠️ ⚠️  EXTREME RISK DETECTED - DUST-STYLE PUMP & DUMP  ⚠️ ⚠️ ⚠️
This shows all signs of coordinated manipulation. DO NOT ENTER!
      `));
    }
  }

  // Quick check method for the trading bot
  async quickPumpCheck(token: Token): Promise<boolean> {
    const volumeMCRatio = token.fdv > 0 ? token.volume24h / token.fdv : 0;
    
    // Red flags = don't trade
    if (volumeMCRatio > 1.5) return false;
    if (token.priceChange24h < -30) return false;
    if (token.liquidity < 10000) return false;
    
    // Green flags = consider trading
    if (volumeMCRatio < 0.5 && token.priceChange24h > 10) return true;
    if (token.liquidity > 100000 && volumeMCRatio < 1) return true;
    
    return false;
  }
}