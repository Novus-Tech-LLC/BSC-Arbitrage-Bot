import axios from 'axios';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { Token } from '../types';
import chalk from 'chalk';

interface ClaudeResponse {
  should_invest: boolean;
  confidence: number;
  narrative_score: number;
  pump_phase: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | 'EXTREME';
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number[];
  reasoning: string;
  warnings: string[];
}

interface ClaudeConfig {
  claude: {
    api_key: string;
    model: string;
    temperature: number;
    max_tokens: number;
  };
  analysis: {
    scan_interval: number;
    batch_size: number;
    thresholds: {
      narrative_score: number;
      pump_score: number;
      combined_score: number;
    };
    risk_limits: {
      max_risk_level: string;
      max_volume_mc_ratio: number;
      min_liquidity: number;
    };
  };
  prompts: {
    market_analysis: string;
    opportunity_scan: string;
    exit_analysis: string;
  };
}

export class ClaudeAIService {
  private config: ClaudeConfig;
  private apiKey: string;
  private isActive: boolean = false;
  private analysisHistory: Map<string, ClaudeResponse> = new Map();

  constructor() {
    // Load configuration
    const configPath = path.join(process.cwd(), 'claude-config.yaml');
    const configFile = fs.readFileSync(configPath, 'utf8');
    this.config = yaml.load(configFile) as ClaudeConfig;
    
    // Get API key from environment
    this.apiKey = process.env.CLAUDE_API_KEY || '';
    if (!this.apiKey) {
      console.error(chalk.red('❌ CLAUDE_API_KEY not set in .env file!'));
      console.log(chalk.yellow('Add to .env: CLAUDE_API_KEY=your-api-key'));
    }
  }

  async analyzeToken(token: Token, priceHistory?: any[], marketSentiment?: string): Promise<ClaudeResponse> {
    console.log(chalk.cyan(`🤖 Claude analyzing ${token.symbol}...`));

    const prompt = this.config.prompts.market_analysis
      .replace('{token_data}', JSON.stringify({
        symbol: token.symbol,
        name: token.name,
        price: token.priceUsd,
        marketCap: token.fdv,
        volume24h: token.volume24h,
        priceChange24h: token.priceChange24h,
        liquidity: token.liquidity,
        volumeMCRatio: token.fdv > 0 ? token.volume24h / token.fdv : 0
      }, null, 2))
      .replace('{price_history}', JSON.stringify(priceHistory || []))
      .replace('{market_sentiment}', marketSentiment || 'Neutral');

    try {
      const response = await this.callClaudeAPI(prompt);
      const analysis = this.parseClaudeResponse(response);
      
      // Store analysis
      this.analysisHistory.set(token.address, analysis);
      
      // Log key findings
      this.logAnalysis(token, analysis);
      
      return analysis;
    } catch (error: any) {
      console.error(chalk.red(`❌ Claude API error for ${token.symbol}:`), error.message);
      if (error.response?.data) {
        console.error(chalk.red('Error details:'), JSON.stringify(error.response.data, null, 2));
      }
      // Return conservative analysis on error
      return this.getDefaultAnalysis();
    }
  }

  async scanOpportunities(tokens: Token[]): Promise<Token[]> {
    console.log(chalk.cyan(`🔍 Claude scanning ${tokens.length} tokens for opportunities...`));

    const prompt = this.config.prompts.opportunity_scan
      .replace('{tokens_list}', JSON.stringify(
        tokens.map(t => ({
          symbol: t.symbol,
          name: t.name,
          price: t.priceUsd,
          change24h: t.priceChange24h,
          volume: t.volume24h,
          mcap: t.fdv,
          volumeMCRatio: t.fdv > 0 ? t.volume24h / t.fdv : 0
        })), null, 2
      ));

    try {
      const response = await this.callClaudeAPI(prompt);
      // Parse response to get top token symbols
      const topTokens = this.parseOpportunityScan(response, tokens);
      
      // Analyze each top token in detail
      const detailedAnalyses = await Promise.all(
        topTokens.map(token => this.analyzeToken(token))
      );

      // Filter based on analysis
      return topTokens.filter((token, index) => {
        const analysis = detailedAnalyses[index];
        return analysis.should_invest && 
               analysis.confidence >= this.config.analysis.thresholds.combined_score;
      });
    } catch (error: any) {
      console.error(chalk.red('❌ Claude opportunity scan error:'), error.message);
      if (error.response?.data) {
        console.error(chalk.red('Error details:'), JSON.stringify(error.response.data, null, 2));
      }
      return [];
    }
  }

  async analyzeExit(position: any, currentMarketData: any): Promise<{
    action: 'HOLD' | 'TAKE_PROFIT' | 'STOP_LOSS';
    reasoning: string;
    confidence: number;
  }> {
    const prompt = this.config.prompts.exit_analysis
      .replace('{token}', position.token.symbol)
      .replace('{entry_price}', position.entryPrice.toString())
      .replace('{current_price}', position.currentPrice.toString())
      .replace('{pnl_percent}', position.pnlPercent.toFixed(2))
      .replace('{time_held}', this.formatTimeHeld(position.entryTime))
      .replace('{market_data}', JSON.stringify(currentMarketData, null, 2));

    try {
      const response = await this.callClaudeAPI(prompt);
      return this.parseExitAnalysis(response);
    } catch (error) {
      console.error(chalk.red('❌ Claude exit analysis error:'), error);
      // Conservative exit on error
      return {
        action: position.pnlPercent > 20 ? 'TAKE_PROFIT' : 'HOLD',
        reasoning: 'API error - using conservative strategy',
        confidence: 50
      };
    }
  }

  private async callClaudeAPI(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('CLAUDE_API_KEY not configured');
    }

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: this.config.claude.model,
        max_tokens: this.config.claude.max_tokens,
        temperature: this.config.claude.temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    return response.data.content[0].text;
  }

  private parseClaudeResponse(response: string): ClaudeResponse {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error parsing Claude response:'), error);
    }

    // Return default if parsing fails
    return this.getDefaultAnalysis();
  }

  private parseOpportunityScan(response: string, tokens: Token[]): Token[] {
    try {
      // Extract token symbols from response
      const symbolMatches = response.match(/\$[A-Z]+/g) || [];
      const symbols = symbolMatches.map(s => s.substring(1));
      
      // Find matching tokens
      return tokens.filter(t => symbols.includes(t.symbol));
    } catch (error) {
      console.error(chalk.red('❌ Error parsing opportunity scan:'), error);
      return [];
    }
  }

  private parseExitAnalysis(response: string): {
    action: 'HOLD' | 'TAKE_PROFIT' | 'STOP_LOSS';
    reasoning: string;
    confidence: number;
  } {
    const actionMatch = response.match(/(HOLD|TAKE_PROFIT|STOP_LOSS|Take profits?|Cut losses?|Hold)/i);
    let action: 'HOLD' | 'TAKE_PROFIT' | 'STOP_LOSS' = 'HOLD';
    
    if (actionMatch) {
      const matched = actionMatch[0].toUpperCase();
      if (matched.includes('TAKE') || matched.includes('PROFIT')) {
        action = 'TAKE_PROFIT';
      } else if (matched.includes('STOP') || matched.includes('CUT')) {
        action = 'STOP_LOSS';
      }
    }

    const confidenceMatch = response.match(/(\d+)%?\s*(confidence|confident|certainty)/i);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 70;

    return {
      action,
      reasoning: response.substring(0, 200),
      confidence
    };
  }

  private getDefaultAnalysis(): ClaudeResponse {
    return {
      should_invest: false,
      confidence: 0,
      narrative_score: 0,
      pump_phase: 'unknown',
      risk_level: 'EXTREME',
      entry_price: null,
      stop_loss: null,
      take_profit: [],
      reasoning: 'Analysis unavailable - defaulting to no investment',
      warnings: ['Unable to perform analysis']
    };
  }

  private logAnalysis(token: Token, analysis: ClaudeResponse) {
    const emoji = analysis.should_invest ? '✅' : '❌';
    const riskEmoji = {
      'LOW': '🟢',
      'MEDIUM': '🟡', 
      'HIGH': '🟠',
      'VERY_HIGH': '🔴',
      'EXTREME': '☠️'
    };

    console.log(chalk.yellow(`
╔═══════════════════════════════════════════════════════════════╗
║                    CLAUDE AI ANALYSIS                          ║
╠═══════════════════════════════════════════════════════════════╣
║ Token: ${token.symbol} (${token.name})
║ 
║ ${emoji} Investment Decision: ${analysis.should_invest ? 'INVEST' : 'AVOID'}
║ 📊 Confidence: ${analysis.confidence}%
║ 📖 Narrative Score: ${analysis.narrative_score}/100
║ 🎯 Pump Phase: ${analysis.pump_phase}
║ ${riskEmoji[analysis.risk_level]} Risk Level: ${analysis.risk_level}
║ 
║ 💭 Reasoning: 
║ ${analysis.reasoning.substring(0, 100)}...
║ 
║ ⚠️ Warnings: ${analysis.warnings.length > 0 ? analysis.warnings[0] : 'None'}
╚═══════════════════════════════════════════════════════════════╝
    `));
  }

  private formatTimeHeld(entryTime: Date): string {
    const now = new Date();
    const diff = now.getTime() - entryTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} days`;
    return `${hours} hours`;
  }

  // Start continuous analysis
  startContinuousAnalysis(callback: (opportunities: Token[]) => void) {
    if (!this.apiKey) {
      console.error(chalk.red('❌ Cannot start continuous analysis without API key'));
      return;
    }

    this.isActive = true;
    console.log(chalk.green('🚀 Claude AI continuous analysis started'));

    const analyze = async () => {
      if (!this.isActive) return;

      try {
        // This will be called with trending tokens from the bot
        console.log(chalk.cyan('⏰ Running scheduled Claude analysis...'));
      } catch (error) {
        console.error(chalk.red('❌ Continuous analysis error:'), error);
      }

      // Schedule next analysis
      if (this.isActive) {
        setTimeout(analyze, this.config.analysis.scan_interval * 1000);
      }
    };

    // Start analysis loop
    analyze();
  }

  stopContinuousAnalysis() {
    this.isActive = false;
    console.log(chalk.yellow('🛑 Claude AI continuous analysis stopped'));
  }

  getAnalysisHistory(): Map<string, ClaudeResponse> {
    return this.analysisHistory;
  }
}