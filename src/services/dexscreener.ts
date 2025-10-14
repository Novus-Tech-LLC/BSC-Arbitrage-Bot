import axios from 'axios';
import { config } from '../config';
import { Token, DexScreenerResponse } from '../types';
import chalk from 'chalk';

export class DexScreenerService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.dexscreener.baseUrl;
  }

  async getTrendingTokens(): Promise<Token[]> {
    try {
      console.log(chalk.cyan('🔍 Fetching real trending tokens from DexScreener...'));
      
      // Get trending pairs from all chains, then filter BSC
      const searchUrl = `${this.baseUrl}/dex/search/?q=`;
      console.log(chalk.gray(`API URL: ${searchUrl}`));
      
      const response = await axios.get<any>(searchUrl, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        }
      });

      console.log(chalk.gray(`API Response status: ${response.status}`));
      
      if (!response.data || !response.data.pairs) {
        console.log(chalk.yellow('No pairs data in response, trying alternative endpoint...'));
        // Try alternative endpoint
        const altResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/bsc`, {
          timeout: 10000
        });
        response.data = altResponse.data;
      }

      const tokens = (response.data.pairs || [])
        .filter((pair: any) => {
          // Filter for BSC tokens
          if (pair.chainId !== 'bsc') return false;
          
          const volume24h = pair.volume?.h24 || 0;
          const liquidity = pair.liquidity?.usd || 0;
          return volume24h >= config.bot.minVolume24h && liquidity >= config.bot.minLiquidity;
        })
        .sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
        .slice(0, config.dexscreener.limit)
        .map((pair: any) => ({
          address: pair.baseToken.address,
          symbol: pair.baseToken.symbol,
          name: pair.baseToken.name,
          priceUsd: pair.priceUsd || '0',
          priceChange24h: pair.priceChange?.h24 || 0,
          volume24h: pair.volume?.h24 || 0,
          liquidity: pair.liquidity?.usd || 0,
          fdv: pair.fdv || 0,
          chainId: pair.chainId,
          dexId: pair.dexId,
          pairAddress: pair.pairAddress,
        }));

      console.log(chalk.green(`✅ Found ${tokens.length} trending tokens`));
      return tokens;
    } catch (error) {
      console.error(chalk.red('❌ Error fetching trending tokens:'), error);
      return [];
    }
  }

  async getTokenPrice(address: string): Promise<number> {
    try {
      const response = await axios.get<DexScreenerResponse>(
        `${this.baseUrl}/dex/tokens/${address}`,
        { timeout: 5000 }
      );

      if (response.data.pairs && response.data.pairs.length > 0) {
        return parseFloat(response.data.pairs[0].priceUsd || '0');
      }
      return 0;
    } catch (error) {
      console.error(chalk.red(`❌ Error fetching price for ${address}:`), error);
      return 0;
    }
  }
}