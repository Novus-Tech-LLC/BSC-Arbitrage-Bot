import axios from 'axios';
import { Token } from '../types';
import chalk from 'chalk';
import { AdvancedNarrativeAI } from './advancedNarrativeAI';

interface HuntResult {
  token: Token;
  narrativeAnalysis: any;
  source: string;
  foundAt: Date;
}

export class NarrativeHunter {
  private advancedAI: AdvancedNarrativeAI;
  private huntHistory: Map<string, HuntResult> = new Map();

  // Known successful narrative patterns
  private successfulNarratives = [
    { query: 'dust', narrative: 'CZ/Binance cleanup narrative' },
    { query: 'priceless', narrative: 'Nothing is truly priceless philosophy' },
    { query: 'odin', narrative: 'Norse mythology power narrative' },
    { query: 'pepe', narrative: 'Classic meme culture' },
    { query: 'wagmi', narrative: 'Crypto culture optimism' },
    { query: 'gm', narrative: 'Crypto greeting culture' },
    { query: 'based', narrative: 'Internet culture approval' },
    { query: 'ai bot', narrative: 'AI trend riding' },
    { query: 'moon', narrative: 'Crypto moon mission' },
    { query: 'diamond hands', narrative: 'HODLer culture' }
  ];

  constructor() {
    this.advancedAI = new AdvancedNarrativeAI();
  }

  async huntForNarratives(): Promise<HuntResult[]> {
    console.log(chalk.cyan('🎯 Starting narrative hunt across multiple sources...'));
    
    const allResults: HuntResult[] = [];

    // Method 1: Search DexScreener for specific narratives
    for (const narrative of this.successfulNarratives) {
      const results = await this.searchDexScreenerNarrative(narrative.query);
      allResults.push(...results);
    }

    // Method 2: Get trending on BSC and analyze
    const trending = await this.getTrendingBSC();
    allResults.push(...trending);

    // Method 3: Search for new pairs with high volume
    const newPairs = await this.getNewHighVolumePairs();
    allResults.push(...newPairs);

    // Analyze all found tokens
    const analyzedResults = await this.analyzeAllTokens(allResults);

    // Sort by narrative score
    return analyzedResults.sort((a, b) => 
      b.narrativeAnalysis.narrativeScore - a.narrativeAnalysis.narrativeScore
    );
  }

  private async searchDexScreenerNarrative(query: string): Promise<HuntResult[]> {
    try {
      console.log(chalk.yellow(`🔍 Searching for "${query}" narrative...`));
      
      const response = await axios.get('https://api.dexscreener.com/latest/dex/search', {
        params: { q: query },
        timeout: 10000,
      });

      if (!response.data?.pairs) return [];

      // Filter for BSC tokens with good metrics
      const bscTokens = response.data.pairs
        .filter((pair: any) => 
          pair.chainId === 'bsc' && 
          pair.liquidity?.usd > 5000 &&
          pair.volume?.h24 > 10000
        )
        .slice(0, 5)
        .map((pair: any) => ({
          token: this.convertToToken(pair),
          narrativeAnalysis: null,
          source: `DexScreener search: ${query}`,
          foundAt: new Date()
        }));

      console.log(chalk.green(`✓ Found ${bscTokens.length} BSC tokens for "${query}"`));
      return bscTokens;

    } catch (error) {
      console.log(chalk.red(`✗ Failed to search "${query}"`));
      return [];
    }
  }

  private async getTrendingBSC(): Promise<HuntResult[]> {
    try {
      console.log(chalk.yellow('🔍 Getting BSC trending tokens...'));
      
      const response = await axios.get('https://api.dexscreener.com/latest/dex/tokens/bsc', {
        timeout: 10000,
      });

      if (!response.data?.pairs) {
        // Fallback to search
        const searchResponse = await axios.get('https://api.dexscreener.com/latest/dex/search', {
          params: { q: 'bsc' },
          timeout: 10000,
        });
        
        if (!searchResponse.data?.pairs) return [];
        
        return searchResponse.data.pairs
          .filter((pair: any) => pair.chainId === 'bsc')
          .slice(0, 10)
          .map((pair: any) => ({
            token: this.convertToToken(pair),
            narrativeAnalysis: null,
            source: 'BSC Trending',
            foundAt: new Date()
          }));
      }

      return response.data.pairs
        .slice(0, 10)
        .map((pair: any) => ({
          token: this.convertToToken(pair),
          narrativeAnalysis: null,
          source: 'BSC Trending',
          foundAt: new Date()
        }));

    } catch (error) {
      console.log(chalk.red('✗ Failed to get trending tokens'));
      return [];
    }
  }

  private async getNewHighVolumePairs(): Promise<HuntResult[]> {
    try {
      console.log(chalk.yellow('🔍 Searching for new high-volume pairs...'));
      
      // Search for tokens with high 24h change
      const queries = ['pump', 'moon', 'rocket', '1000x'];
      const results: HuntResult[] = [];

      for (const query of queries) {
        const response = await axios.get('https://api.dexscreener.com/latest/dex/search', {
          params: { q: query },
          timeout: 5000,
        });

        if (response.data?.pairs) {
          const highVolume = response.data.pairs
            .filter((pair: any) => 
              pair.chainId === 'bsc' && 
              pair.priceChange?.h24 > 50 &&
              pair.volume?.h24 > 50000
            )
            .slice(0, 3)
            .map((pair: any) => ({
              token: this.convertToToken(pair),
              narrativeAnalysis: null,
              source: `High volume search: ${query}`,
              foundAt: new Date()
            }));
          
          results.push(...highVolume);
        }
      }

      console.log(chalk.green(`✓ Found ${results.length} high-volume pairs`));
      return results;

    } catch (error) {
      console.log(chalk.red('✗ Failed to search high-volume pairs'));
      return [];
    }
  }

  private async analyzeAllTokens(results: HuntResult[]): Promise<HuntResult[]> {
    console.log(chalk.cyan(`🧠 Analyzing ${results.length} tokens for narrative potential...`));
    
    // Remove duplicates
    const uniqueTokens = new Map<string, HuntResult>();
    results.forEach(r => uniqueTokens.set(r.token.address, r));

    // Analyze each unique token
    const analyzed = await Promise.all(
      Array.from(uniqueTokens.values()).map(async (result) => {
        const analysis = await this.advancedAI.performDeepAnalysis(result.token);
        return {
          ...result,
          narrativeAnalysis: analysis
        };
      })
    );

    // Store in history
    analyzed.forEach(r => {
      if (r.narrativeAnalysis.viralPotential === 'explosive' || 
          r.narrativeAnalysis.viralPotential === 'high') {
        this.huntHistory.set(r.token.address, r);
      }
    });

    return analyzed;
  }

  private convertToToken(pair: any): Token {
    return {
      address: pair.baseToken.address,
      symbol: pair.baseToken.symbol.toUpperCase(),
      name: pair.baseToken.name,
      priceUsd: pair.priceUsd || '0',
      priceChange24h: pair.priceChange?.h24 || 0,
      volume24h: pair.volume?.h24 || 0,
      liquidity: pair.liquidity?.usd || 0,
      fdv: pair.fdv || 0,
      chainId: pair.chainId,
      dexId: pair.dexId,
      pairAddress: pair.pairAddress,
      logo: `https://dd.dexscreener.com/ds-data/tokens/${pair.chainId}/${pair.baseToken.address}.png`,
      website: pair.info?.websites?.[0] || '',
      dexScreenerUrl: `https://dexscreener.com/${pair.chainId}/${pair.pairAddress}`,
    };
  }

  async getExplosiveOpportunities(): Promise<HuntResult[]> {
    const results = await this.huntForNarratives();
    
    return results.filter(r => 
      r.narrativeAnalysis?.viralPotential === 'explosive' ||
      (r.narrativeAnalysis?.viralPotential === 'high' && 
       r.narrativeAnalysis?.narrativeScore >= 70)
    );
  }

  getHuntHistory(): HuntResult[] {
    return Array.from(this.huntHistory.values())
      .sort((a, b) => b.foundAt.getTime() - a.foundAt.getTime());
  }

  async searchSpecificToken(symbol: string): Promise<HuntResult | null> {
    console.log(chalk.cyan(`🔍 Searching for specific token: ${symbol}...`));
    
    try {
      const response = await axios.get('https://api.dexscreener.com/latest/dex/search', {
        params: { q: symbol },
        timeout: 10000,
      });

      if (!response.data?.pairs || response.data.pairs.length === 0) {
        console.log(chalk.red(`✗ Token ${symbol} not found`));
        return null;
      }

      // Find best match on BSC
      const bscPair = response.data.pairs.find((p: any) => 
        p.chainId === 'bsc' && 
        p.baseToken.symbol.toUpperCase() === symbol.toUpperCase()
      ) || response.data.pairs[0];

      const token = this.convertToToken(bscPair);
      const analysis = await this.advancedAI.performDeepAnalysis(token);

      const result = {
        token,
        narrativeAnalysis: analysis,
        source: `Direct search: ${symbol}`,
        foundAt: new Date()
      };

      return result;

    } catch (error) {
      console.log(chalk.red(`✗ Error searching for ${symbol}`));
      return null;
    }
  }
}