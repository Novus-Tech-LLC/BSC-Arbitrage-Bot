import { DexScreenerService } from './dexscreener';
import { MockDexScreenerService } from './mockDexScreener';
import { CoinGeckoService } from './coingecko';
import { BSCTokensService } from './bscTokens';
import { BSCMemecoinsService } from './bscMemecoins';
import { PaperTradingService } from './paperTrading';
import { NarrativeAnalyzer } from './narrativeAnalyzer';
import { PumpDetectorAI } from './pumpDetectorAI';
import { ClaudeAIService } from './claudeAI';
import { DexScreenerResearch } from './dexScreenerResearch';
import { Token, BotStatus } from '../types';
import { config } from '../config';
import chalk from 'chalk';

export class TradingBot {
  private tokenService: DexScreenerService | MockDexScreenerService | CoinGeckoService | BSCTokensService | BSCMemecoinsService;
  private paperTrading: PaperTradingService;
  private narrativeAnalyzer: NarrativeAnalyzer;
  private pumpDetectorAI: PumpDetectorAI;
  private claudeAI: ClaudeAIService;
  private dexResearch: DexScreenerResearch;
  private isRunning: boolean = false;
  private trendingTokens: Token[] = [];
  private narrativeScores: Map<string, any> = new Map();
  private pumpAnalyses: Map<string, any> = new Map();
  private claudeAnalyses: Map<string, any> = new Map();
  private listeners: ((event: string, data: any) => void)[] = [];

  constructor() {
    // Use BSC memecoins service for NEW trending tokens like PRICELESS, DUST
    this.tokenService = new BSCMemecoinsService(); 
    this.paperTrading = new PaperTradingService();
    this.narrativeAnalyzer = new NarrativeAnalyzer();
    this.pumpDetectorAI = new PumpDetectorAI();
    this.claudeAI = new ClaudeAIService();
    this.dexResearch = new DexScreenerResearch();
    console.log(chalk.yellow('🚀 Using BSC memecoins service with REAL-TIME DexScreener data + AI Narrative Analysis + Pump Detection + Claude Pro Max!'));
    
    // Subscribe to real-time updates
    if (this.tokenService instanceof BSCMemecoinsService) {
      this.tokenService.onUpdate((tokens) => {
        console.log(chalk.green(`🔄 Real-time update: ${tokens.length} trending tokens`));
        this.trendingTokens = tokens;
        this.emit('trending-update', tokens);
      });
    }
    
    // Initialize with some pre-populated analyses
    this.initializePrePopulatedAnalyses();
  }

  private initializePrePopulatedAnalyses() {
    // Pre-populated analysis for demonstration
    const mockAnalyses = [
      {
        token: {
          address: '0xprepop1',
          symbol: 'DOGE2.0',
          name: 'Doge 2.0',
          priceUsd: '0.00234',
          priceChange24h: 156.7,
          volume24h: 5678000,
          liquidity: 2340000,
          fdv: 23400000,
          chainId: 'bsc',
          dexId: 'pancakeswap',
        },
        narrative: {
          symbol: 'DOGE2.0',
          score: 85,
          viralPotential: 'explosive',
          type: 'Redemption Arc',
          reasoning: 'Strong meme legacy + redemption narrative + Elon tweet potential',
          sentiment: 'EXTREMELY BULLISH'
        },
        pumpAnalysis: {
          phase: 'initial_pump',
          pumpScore: 78,
          riskLevel: 'MEDIUM',
          entryAnalysis: { shouldEnter: true },
          warnings: [],
          insights: ['Volume surge detected', 'Community growing rapidly']
        },
        claudeAnalysis: {
          should_invest: true,
          confidence: 82,
          narrative_score: 85,
          pump_phase: 'initial_pump',
          risk_level: 'MEDIUM',
          reasoning: 'Strong community revival pattern with authentic organic growth'
        }
      },
      {
        token: {
          address: '0xprepop2',
          symbol: 'AIPEPE',
          name: 'AI Pepe',
          priceUsd: '0.0000567',
          priceChange24h: 234.5,
          volume24h: 8900000,
          liquidity: 3450000,
          fdv: 5670000,
          chainId: 'bsc',
          dexId: 'pancakeswap',
        },
        narrative: {
          symbol: 'AIPEPE',
          score: 92,
          viralPotential: 'explosive',
          type: 'AI/Tech Trend',
          reasoning: 'Perfect timing: AI hype + Pepe meme fusion',
          sentiment: 'EXTREMELY BULLISH'
        },
        pumpAnalysis: {
          phase: 'accumulation',
          pumpScore: 88,
          riskLevel: 'LOW',
          entryAnalysis: { shouldEnter: true },
          warnings: [],
          insights: ['Early accumulation phase', 'Smart money entering']
        },
        claudeAnalysis: {
          should_invest: true,
          confidence: 89,
          narrative_score: 92,
          pump_phase: 'accumulation',
          risk_level: 'LOW',
          reasoning: 'Exceptional narrative timing with AI trend convergence'
        }
      }
    ];

    // Add to maps
    mockAnalyses.forEach(analysis => {
      this.narrativeScores.set(analysis.token.address, analysis.narrative);
      this.pumpAnalyses.set(analysis.token.address, analysis.pumpAnalysis);
      this.claudeAnalyses.set(analysis.token.address, analysis.claudeAnalysis);
      this.trendingTokens.push(analysis.token as Token);
    });
  }

  addEventListener(listener: (event: string, data: any) => void) {
    this.listeners.push(listener);
  }

  private emit(event: string, data: any) {
    this.listeners.forEach(listener => listener(event, data));
  }

  async start() {
    this.isRunning = true;
    console.log(chalk.cyan('🤖 Trading bot started in PAPER TRADING mode'));
    this.emit('status', this.getStatus());
    
    // Start real-time position price updates
    setInterval(() => {
      this.paperTrading.simulatePriceUpdates();
      this.emit('positions', this.paperTrading.getAllPositions());
    }, 2000); // Update every 2 seconds
    
    // Start DexScreener hourly research
    this.dexResearch.startHourlyResearch((reports) => {
      console.log(chalk.yellow(`📊 New DexScreener research: ${reports.length} reports`));
      this.emit('research', reports.map(r => ({ ...r, isNew: true })));
      
      // Alert on high opportunity coins
      reports.forEach(report => {
        if (report.volumeMultiple > 10) {
          this.emit('activity', {
            type: 'research',
            message: `📊 VOLUME BLAST: ${report.coin.symbol} surged ${report.volumeMultiple.toFixed(0)}x volume!`,
            timestamp: new Date(),
            priority: 'high'
          });
        }
      });
    });
    
    while (this.isRunning) {
      await this.scanAndTrade();
      await this.delay(config.bot.scanInterval);
    }
  }

  stop() {
    this.isRunning = false;
    this.dexResearch.stopResearch();
    console.log(chalk.yellow('🛑 Trading bot stopped'));
    this.emit('status', this.getStatus());
  }

  private async scanAndTrade() {
    try {
      // Fetch trending BSC tokens
      this.emit('ai-thinking', { agent: 'SYSTEM', message: 'Starting BSC token scan...' });
      
      if (this.tokenService instanceof BSCTokensService) {
        this.trendingTokens = await this.tokenService.getTrendingBSCTokens();
      } else if (this.tokenService instanceof BSCMemecoinsService) {
        this.emit('ai-thinking', { agent: 'DEXSCREEN', message: 'Fetching real-time BSC trending tokens from DexScreener...' });
        this.trendingTokens = await this.tokenService.getTrendingBSCTokens();
      } else {
        this.trendingTokens = await this.tokenService.getTrendingTokens();
      }
      
      this.emit('ai-thinking', { agent: 'DEXSCREEN', message: `Found ${this.trendingTokens.length} trending BSC tokens` });
      this.emit('trending', this.trendingTokens);

      // Analyze narratives and pump patterns of trending tokens
      if (this.trendingTokens.length > 0) {
        console.log(chalk.cyan('🤖 AI analyzing token narratives...'));
        this.emit('ai-thinking', { agent: 'NARRATIVE', message: `Analyzing narratives for ${this.trendingTokens.length} tokens...` });
        
        const narrativeAnalyses = await this.narrativeAnalyzer.analyzeTrendingTokens(this.trendingTokens);
        
        // Store narrative scores
        narrativeAnalyses.forEach(analysis => {
          this.narrativeScores.set(analysis.token.address, analysis);
        });

        // Emit narrative analysis for dashboard
        this.emit('narratives', narrativeAnalyses);
        
        // Get best narrative picks
        const bestPicks = this.narrativeAnalyzer.getBestNarrativePicks(narrativeAnalyses);
        if (bestPicks.length > 0) {
          console.log(chalk.green(`🎯 Found ${bestPicks.length} tokens with explosive narrative potential!`));
          this.emit('ai-thinking', { agent: 'NARRATIVE', message: `Identified ${bestPicks.length} tokens with explosive viral potential` });
        }

        // Run pump detection AI on all trending tokens
        console.log(chalk.cyan('🔍 AI detecting pump patterns...'));
        this.emit('ai-thinking', { agent: 'PUMP-AI', message: `Starting pump pattern detection on ${this.trendingTokens.length} tokens...` });
        
        for (const token of this.trendingTokens) {
          const pumpAnalysis = await this.pumpDetectorAI.analyzePump(token);
          this.pumpAnalyses.set(token.address, pumpAnalysis);
          
          if (pumpAnalysis.entryAnalysis.shouldEnter) {
            this.emit('ai-thinking', { agent: 'PUMP-AI', message: `${token.symbol}: ${pumpAnalysis.phase} phase detected - ENTRY SIGNAL` });
          } else {
            this.emit('ai-thinking', { agent: 'PUMP-AI', message: `${token.symbol}: ${pumpAnalysis.phase} phase - ${pumpAnalysis.riskLevel} risk` });
          }
        }

        // Emit pump analyses for dashboard
        this.emit('pumpAnalyses', Array.from(this.pumpAnalyses.values()));

        // Use Claude AI to find best opportunities
        if (process.env.CLAUDE_API_KEY) {
          console.log(chalk.cyan('🤖 Claude Pro Max analyzing opportunities...'));
          this.emit('ai-thinking', { agent: 'CLAUDE', message: `Scanning ${this.trendingTokens.length} tokens for opportunities...` });
          
          const claudeOpportunities = await this.claudeAI.scanOpportunities(this.trendingTokens);
          
          if (claudeOpportunities.length > 0) {
            this.emit('ai-thinking', { agent: 'CLAUDE', message: `Found ${claudeOpportunities.length} potential opportunities` });
          }
          
          // Deep analyze top opportunities
          for (const token of claudeOpportunities.slice(0, 3)) {
            this.emit('ai-thinking', { agent: 'CLAUDE', message: `Deep analyzing ${token.symbol}...` });
            
            const claudeAnalysis = await this.claudeAI.analyzeToken(token);
            this.claudeAnalyses.set(token.address, claudeAnalysis);
            
            // Emit Claude analysis
            this.emit('claudeAnalysis', {
              token: token,
              analysis: claudeAnalysis
            });

            // Alert on high confidence opportunities
            if (claudeAnalysis.should_invest && claudeAnalysis.confidence >= 80) {
              this.emit('ai-thinking', { 
                agent: 'CLAUDE', 
                message: `🎯 HIGH CONFIDENCE: ${token.symbol} - ${claudeAnalysis.confidence}% confidence to invest` 
              });
              
              this.emit('activity', {
                type: 'claude-alert',
                message: `🤖 CLAUDE ALERT: ${token.symbol} - ${claudeAnalysis.confidence}% confidence | ${claudeAnalysis.reasoning}`,
                timestamp: new Date(),
                priority: 'high'
              });
            } else if (claudeAnalysis.should_invest) {
              this.emit('ai-thinking', { 
                agent: 'CLAUDE', 
                message: `${token.symbol} - ${claudeAnalysis.confidence}% confidence, ${claudeAnalysis.reasoning.substring(0, 50)}...` 
              });
            } else {
              this.emit('ai-thinking', { 
                agent: 'CLAUDE', 
                message: `${token.symbol} - AVOID (${claudeAnalysis.confidence}% confidence)` 
              });
            }
          }
        }
      }

      // Update existing positions with real-time prices
      const priceMap = new Map<string, number>();
      
      // First add current trending token prices
      for (const token of this.trendingTokens) {
        priceMap.set(token.address, parseFloat(token.priceUsd));
      }
      
      // Then update open positions with real-time prices
      const openPositions = this.paperTrading.getOpenPositions();
      for (const position of openPositions) {
        if (position.token.coinGeckoId && (this.tokenService instanceof CoinGeckoService || this.tokenService instanceof BSCTokensService)) {
          const currentPrice = await this.tokenService.getTokenPrice(position.token.coinGeckoId);
          priceMap.set(position.token.address, currentPrice);
        } else if (this.tokenService instanceof BSCMemecoinsService) {
          const currentPrice = await this.tokenService.getTokenPrice(position.token.address);
          priceMap.set(position.token.address, currentPrice);
        } else {
          // Fallback to existing price
          const currentPrice = await this.tokenService.getTokenPrice(position.token.address);
          priceMap.set(position.token.address, currentPrice);
        }
      }
      
      this.paperTrading.updatePositions(priceMap);
      
      // Check exits with Claude AI for open positions
      if (process.env.CLAUDE_API_KEY) {
        const openPositions = this.paperTrading.getOpenPositions();
        for (const position of openPositions) {
          // Only check positions held for more than 30 minutes
          const holdTime = Date.now() - position.entryTime.getTime();
          if (holdTime > 30 * 60 * 1000) {
            const token = this.trendingTokens.find(t => t.address === position.token.address);
            if (token) {
              const exitAnalysis = await this.claudeAI.analyzeExit(position, {
                currentPrice: position.currentPrice,
                volume24h: token.volume24h,
                priceChange: token.priceChange24h
              });
              
              if (exitAnalysis.action !== 'HOLD' && exitAnalysis.confidence >= 70) {
                this.emit('activity', {
                  type: 'claude-exit',
                  message: `🤖 CLAUDE EXIT SIGNAL: ${position.token.symbol} - ${exitAnalysis.action} (${exitAnalysis.confidence}% confidence)`,
                  timestamp: new Date(),
                  priority: 'high'
                });
                
                // Execute exit if confidence high enough
                if (exitAnalysis.confidence >= 80) {
                  const trade = this.paperTrading.executeSell(
                    position.id, 
                    position.currentPrice,
                    `Claude AI: ${exitAnalysis.action} - ${exitAnalysis.reasoning}`
                  );
                  if (trade) {
                    this.emit('trade', trade);
                  }
                }
              }
            }
          }
        }
      }
      
      this.emit('positions', this.paperTrading.getAllPositions());
      this.emit('trades', this.paperTrading.getTrades());

      // Look for new opportunities and maintain position balance
      if (openPositions.length < config.bot.maxPositions) {
        // Check which strategy type we need
        const positionBalance = this.paperTrading.getPositionBalance();
        console.log(chalk.cyan(`📊 Position balance: ${positionBalance.scalp} scalps, ${positionBalance.swing} swings, ${positionBalance.hold} holds`));
        
        // Prioritize strategy type we're missing
        const neededStrategies = [];
        if (this.paperTrading.needsPositionType('hold')) neededStrategies.push('hold');
        if (this.paperTrading.needsPositionType('swing')) neededStrategies.push('swing');
        if (this.paperTrading.needsPositionType('scalp')) neededStrategies.push('scalp');
        
        this.emit('ai-thinking', { agent: 'SYSTEM', message: `Looking for opportunities (need ${neededStrategies.join(', ') || 'any'} strategy)...` });
        
        const opportunity = this.findBestOpportunity(neededStrategies.length > 0 ? neededStrategies[0] as any : undefined);
        if (opportunity) {
          this.emit('ai-thinking', { agent: 'SYSTEM', message: `Found opportunity: ${opportunity.symbol} at $${opportunity.priceUsd}` });
          
          await this.delay(Math.random() * 2000 + 1000); // Realistic delay
          
          // Determine strategy based on narrative and pump analysis
          const narrative = this.narrativeScores.get(opportunity.address);
          const pumpAnalysis = this.pumpAnalyses.get(opportunity.address);
          const claudeAnalysis = this.claudeAnalyses.get(opportunity.address);
          
          // Use narrative analyzer to determine strategy
          const strategyRecommendation = narrative ? 
            this.narrativeAnalyzer.determineStrategy(opportunity, narrative.score, narrative.viralPotential) : 
            { strategy: 'scalp' as const, targetHoldTime: 8, narrativeStrength: 'weak' as const, reasoning: 'No narrative analysis available' };
          
          // Override with pump detector strategy if available
          const finalStrategy = pumpAnalysis?.entryAnalysis?.strategy || strategyRecommendation.strategy;
          const finalHoldTime = pumpAnalysis?.entryAnalysis?.strategy ? 
            (pumpAnalysis.entryAnalysis.strategy === 'scalp' ? 6 : 
             pumpAnalysis.entryAnalysis.strategy === 'swing' ? 36 : 96) : 
            strategyRecommendation.targetHoldTime;
          
          const trade = this.paperTrading.executeBuy(
            opportunity, 
            config.bot.positionSize,
            finalStrategy,
            finalHoldTime,
            strategyRecommendation.narrativeStrength
          );
          
          if (trade) {
            this.emit('ai-thinking', { 
              agent: 'SYSTEM', 
              message: `EXECUTING BUY: ${opportunity.symbol} with ${finalStrategy.toUpperCase()} strategy (${finalHoldTime}h hold time)` 
            });
            
            this.emit('trade', trade);
            this.emit('positions', this.paperTrading.getAllPositions());
            
            let message = `Bought ${opportunity.symbol} (${finalStrategy.toUpperCase()}) - ${narrative?.narrativeType || 'Unknown'} narrative (Score: ${narrative?.score || 0}/100) | Pump Phase: ${pumpAnalysis?.phase || 'unknown'} | Risk: ${pumpAnalysis?.riskLevel || 'unknown'}`;
            
            if (claudeAnalysis) {
              message += ` | 🤖 Claude: ${claudeAnalysis.confidence}% confidence`;
            }
            
            this.emit('activity', {
              type: 'buy',
              message: message,
              timestamp: new Date(),
              details: {
                narrative: narrative,
                pumpAnalysis: pumpAnalysis,
                claudeAnalysis: claudeAnalysis,
                strategy: finalStrategy
              }
            });
          }
        }
      }

      // Update stats
      this.emit('stats', this.paperTrading.getStats());
      this.emit('status', this.getStatus());

    } catch (error) {
      console.error(chalk.red('❌ Bot error:'), error);
      this.emit('error', { message: 'Bot encountered an error', error });
    }
  }

  private findBestOpportunity(preferredStrategy?: 'scalp' | 'swing' | 'hold'): Token | null {
    const openAddresses = new Set(
      this.paperTrading.getOpenPositions().map(p => p.token.address)
    );

    const candidates = this.trendingTokens.filter(token => {
      // Basic filters
      if (openAddresses.has(token.address)) return false;
      if (token.volume24h < 1000) return false; // Min $1k volume for memecoins
      
      // Check narrative score
      const narrative = this.narrativeScores.get(token.address);
      if (!narrative) return false;
      
      // Check pump analysis - CRITICAL FILTER
      const pumpAnalysis = this.pumpAnalyses.get(token.address);
      if (!pumpAnalysis) return false;
      
      // Skip if pump detector says NO
      if (!pumpAnalysis.entryAnalysis.shouldEnter) {
        console.log(chalk.red(`❌ ${token.symbol} - Pump detector says NO ENTRY (${pumpAnalysis.phase})`));
        return false;
      }
      
      // Skip extreme risk tokens
      if (pumpAnalysis.riskLevel === 'EXTREME') {
        console.log(chalk.red(`☠️ ${token.symbol} - EXTREME RISK detected`));
        return false;
      }

      // Check Claude AI analysis if available
      const claudeAnalysis = this.claudeAnalyses.get(token.address);
      if (claudeAnalysis && !claudeAnalysis.should_invest) {
        console.log(chalk.red(`🤖 ${token.symbol} - Claude AI says NO (${claudeAnalysis.confidence}% confidence)`));
        return false;
      }
      
      // If we have a preferred strategy, check if this token matches
      if (preferredStrategy) {
        const strategyRecommendation = this.narrativeAnalyzer.determineStrategy(token, narrative.score, narrative.viralPotential);
        const pumpStrategy = pumpAnalysis?.entryAnalysis?.strategy;
        const tokenStrategy = pumpStrategy || strategyRecommendation.strategy;
        
        // Prioritize tokens that match our needed strategy
        if (tokenStrategy !== preferredStrategy) {
          // But don't completely exclude them - just deprioritize
          return false;
        }
      }
      
      // Only trade tokens with high narrative potential AND safe pump phase
      return (narrative.viralPotential === 'explosive' || 
              narrative.viralPotential === 'high' ||
              (narrative.viralPotential === 'medium' && narrative.score >= 50)) &&
             (pumpAnalysis.phase === 'accumulation' || pumpAnalysis.phase === 'initial_pump');
    });

    if (candidates.length === 0) {
      // If we couldn't find anything with preferred strategy, look for any good opportunity
      if (preferredStrategy) {
        console.log(chalk.yellow(`⚠️ No ${preferredStrategy} opportunities found, looking for any good opportunity...`));
        return this.findBestOpportunity(); // Recursive call without preference
      }
      return null;
    }

    // Sort by combined score: Claude AI weight highest if available
    return candidates.sort((a, b) => {
      const narrativeA = this.narrativeScores.get(a.address);
      const narrativeB = this.narrativeScores.get(b.address);
      const pumpA = this.pumpAnalyses.get(a.address);
      const pumpB = this.pumpAnalyses.get(b.address);
      const claudeA = this.claudeAnalyses.get(a.address);
      const claudeB = this.claudeAnalyses.get(b.address);
      
      // If Claude analyzed it and recommends, give it huge weight
      const scoreA = claudeA?.should_invest ? 
        (claudeA.confidence * 0.5 + (narrativeA?.score || 0) * 0.3 + (pumpA?.pumpScore || 0) * 0.2) :
        ((narrativeA?.score || 0) * 0.4 + (pumpA?.pumpScore || 0) * 0.4 + (a.priceChange24h / 100) * 0.2);
        
      const scoreB = claudeB?.should_invest ?
        (claudeB.confidence * 0.5 + (narrativeB?.score || 0) * 0.3 + (pumpB?.pumpScore || 0) * 0.2) :
        ((narrativeB?.score || 0) * 0.4 + (pumpB?.pumpScore || 0) * 0.4 + (b.priceChange24h / 100) * 0.2);
      
      return scoreB - scoreA;
    })[0];
  }

  getStatus(): BotStatus {
    const stats = this.paperTrading.getStats();
    return {
      running: this.isRunning,
      mode: config.bot.tradingEnabled ? 'live' : 'paper',
      balance: stats.balance,
      totalPnl: stats.totalPnl,
      winRate: stats.winRate,
      tradesCount: stats.tradesCount,
      openPositions: stats.openPositions,
      lastUpdate: new Date(),
    };
  }

  getTrendingTokens(): Token[] {
    return this.trendingTokens;
  }

  getNarrativeScores(): any[] {
    return Array.from(this.narrativeScores.values());
  }

  getPumpAnalyses(): any[] {
    return Array.from(this.pumpAnalyses.values());
  }

  getClaudeAnalyses(): any[] {
    return Array.from(this.claudeAnalyses.values());
  }

  getResearchHistory(): any[] {
    return this.dexResearch.getLatestReports(10);
  }

  async analyzeSpecificToken(address: string): Promise<{ narrative: any, pumpAnalysis: any, claudeAnalysis?: any } | null> {
    const token = this.trendingTokens.find(t => t.address === address);
    if (!token) return null;

    const narrativeAnalysis = await this.narrativeAnalyzer.analyzeToken(token);
    const pumpAnalysis = await this.pumpDetectorAI.analyzePump(token);

    this.narrativeScores.set(address, narrativeAnalysis);
    this.pumpAnalyses.set(address, pumpAnalysis);

    let claudeAnalysis = null;
    if (process.env.CLAUDE_API_KEY) {
      claudeAnalysis = await this.claudeAI.analyzeToken(token);
      this.claudeAnalyses.set(address, claudeAnalysis);
    }

    return { narrative: narrativeAnalysis, pumpAnalysis, claudeAnalysis };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}