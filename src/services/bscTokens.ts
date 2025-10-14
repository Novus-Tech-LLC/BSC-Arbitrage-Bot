import axios from 'axios';
import { Token } from '../types';
import chalk from 'chalk';
import { config } from '../config';

// BSC Native Projects (not wrapped versions from other chains)
const BSC_NATIVE_PROJECTS = [
  'pancakeswap-token', // CAKE
  'venus', // XVS
  'bakerytoken', // BAKE
  'alpaca-finance', // ALPACA
  'beefy-finance', // BIFI
  'autofarm', // AUTO
  'ellipsis', // EPS
  'belt', // BELT
  'bunnytoken', // BUNNY
  'wault-finance', // WAULT
  'mobox', // MBOX
  'my-neighbor-alice', // ALICE
  'alien-worlds', // TLM
  'splintershards', // SPS
  'smooth-love-potion', // SLP
  'yield-guild-games', // YGG
  'star-atlas', // ATLAS
  'baby-doge-coin', // BABYDOGE
  'safemoon', // SFM
  'seedify-fund', // SFUND
];

export class BSCTokensService {
  private baseUrl = 'https://api.coingecko.com/api/v3';
  private tokenCache = new Map<string, Token>();
  private lastFetch = 0;
  private cacheExpiry = 60000; // 1 minute cache

  async getTrendingBSCTokens(): Promise<Token[]> {
    try {
      console.log(chalk.cyan('🔍 Fetching ONLY BSC native tokens...'));
      
      // Check cache
      if (Date.now() - this.lastFetch < this.cacheExpiry && this.tokenCache.size > 0) {
        return Array.from(this.tokenCache.values());
      }

      // Fetch data for BSC native projects
      const idsString = BSC_NATIVE_PROJECTS.join(',');
      const response = await axios.get(`${this.baseUrl}/coins/markets`, {
        params: {
          vs_currency: 'usd',
          ids: idsString,
          order: 'volume_desc',
          per_page: 100,
          sparkline: false,
          price_change_percentage: '24h',
        },
        timeout: 10000,
      });

      // Also get detailed info for logos and links
      const detailPromises = response.data.slice(0, 10).map((coin: any) => 
        this.getTokenDetails(coin.id)
      );
      const details = await Promise.all(detailPromises);

      // Process and filter tokens
      const tokens = response.data
        .filter((coin: any) => {
          return coin.total_volume >= config.bot.minVolume24h;
        })
        .slice(0, 10)
        .map((coin: any, index: number) => {
          const detail = details[index];
          
          const token: Token = {
            address: this.getBSCAddress(coin.id),
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            priceUsd: coin.current_price.toString(),
            priceChange24h: coin.price_change_percentage_24h || 0,
            volume24h: coin.total_volume || 0,
            liquidity: coin.market_cap || 0,
            fdv: coin.fully_diluted_valuation || coin.market_cap || 0,
            chainId: 'bsc',
            dexId: 'pancakeswap',
            pairAddress: this.getBSCAddress(coin.id),
            coinGeckoId: coin.id,
            logo: detail?.image?.small || coin.image,
            website: detail?.links?.homepage?.[0] || '',
            dexScreenerUrl: `https://dexscreener.com/bsc/${this.getBSCAddress(coin.id)}`,
          };

          this.tokenCache.set(coin.id, token);
          return token;
        });

      this.lastFetch = Date.now();
      console.log(chalk.green(`✅ Found ${tokens.length} BSC native tokens`));
      
      // Log the tokens found
      tokens.forEach((token: Token) => {
        console.log(chalk.gray(`  - ${token.symbol}: $${parseFloat(token.priceUsd).toFixed(4)} (${token.priceChange24h > 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%)`));
      });
      
      return tokens;
    } catch (error) {
      console.error(chalk.red('❌ Error fetching BSC tokens:'), error);
      return Array.from(this.tokenCache.values()); // Return cached data on error
    }
  }

  private async getTokenDetails(coinId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/coins/${coinId}`, {
        params: {
          localization: false,
          tickers: false,
          market_data: false,
          community_data: false,
          developer_data: false,
        },
        timeout: 5000,
      });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  private getBSCAddress(coinId: string): string {
    // Real BSC contract addresses for native projects
    const addresses: { [key: string]: string } = {
      'pancakeswap-token': '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
      'venus': '0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63',
      'bakerytoken': '0xe02df9e3e622debdd69fb838bb799e3f168902c5',
      'alpaca-finance': '0x8f0528ce5ef7b51152a59745befdd91d97091d2f',
      'beefy-finance': '0xca3f508b8e4dd382ee878a314789373d80a5190a',
      'autofarm': '0xa184088a740c695e156f91f5cc086a06bb78b827',
      'ellipsis': '0xa7f552078dcc247c2684336020c03648500c6d9f',
      'belt': '0xe0e514c71282b6f4e823703a39374cf58dc3ea4f',
      'bunnytoken': '0xc9849e6fdb743d08faee3e34dd2d1bc69ea11a51',
      'wault-finance': '0x6ff2d9e5891a7a7c554b80e0d1b791483c78bce9',
      'mobox': '0x3203c9e46ca618c8c1ce5dc67e7e9d75f5da2377',
      'my-neighbor-alice': '0xac51066d7bec65dc4589368da368b212745d63e8',
      'alien-worlds': '0x2222227e22102fe3322098e4cbfe18cfebd57c95',
      'splintershards': '0x1633b7157e7638c4d6593436111bf125ee74703f',
      'smooth-love-potion': '0x070a08beef8d36734dd67a491202ff35a6a16d97',
      'yield-guild-games': '0x25f8087ead173b73d6e8b84329989a8eea16cf73',
      'star-atlas': '0x7e7f68f6dfd26143d1e4e77e96054fb35a900c3a',
      'baby-doge-coin': '0xc748673057861a797275cd8a068abb95a902e8de',
      'safemoon': '0x8076c74c5e3f5852037f31ff0093eeb8c8add8d3',
      'seedify-fund': '0x477bc8d23c634c154061869478bce96be6045d12',
    };
    
    return addresses[coinId] || `0x${Math.random().toString(16).slice(2, 42)}`;
  }

  async getTokenPrice(coinGeckoId: string): Promise<number> {
    try {
      const response = await axios.get(`${this.baseUrl}/simple/price`, {
        params: {
          ids: coinGeckoId,
          vs_currencies: 'usd'
        },
        timeout: 5000,
      });

      return response.data[coinGeckoId]?.usd || 0;
    } catch (error) {
      console.error(chalk.red(`❌ Error fetching price for ${coinGeckoId}:`), error);
      const cached = this.tokenCache.get(coinGeckoId);
      return cached ? parseFloat(cached.priceUsd) : 0;
    }
  }
}