import { Token } from '../types';
import chalk from 'chalk';

export class MockDexScreenerService {
  private mockTokens: Token[] = [
    {
      address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
      symbol: 'CAKE',
      name: 'PancakeSwap Token',
      priceUsd: '2.45',
      priceChange24h: 15.3,
      volume24h: 8500000,
      liquidity: 125000000,
      fdv: 450000000,
      chainId: 'bsc',
      dexId: 'pancakeswap',
      pairAddress: '0x123...'
    },
    {
      address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
      symbol: 'WBNB',
      name: 'Wrapped BNB',
      priceUsd: '315.80',
      priceChange24h: 3.2,
      volume24h: 45000000,
      liquidity: 890000000,
      fdv: 50000000000,
      chainId: 'bsc',
      dexId: 'pancakeswap',
      pairAddress: '0x456...'
    },
    {
      address: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
      symbol: 'ETH',
      name: 'Ethereum Token',
      priceUsd: '2145.60',
      priceChange24h: -1.5,
      volume24h: 12000000,
      liquidity: 340000000,
      fdv: 0,
      chainId: 'bsc',
      dexId: 'pancakeswap',
      pairAddress: '0x789...'
    },
    {
      address: '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c',
      symbol: 'BTCB',
      name: 'Binance BTC',
      priceUsd: '43250.00',
      priceChange24h: 2.8,
      volume24h: 18500000,
      liquidity: 560000000,
      fdv: 0,
      chainId: 'bsc',
      dexId: 'pancakeswap',
      pairAddress: '0xabc...'
    },
    {
      address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      symbol: 'USDC',
      name: 'USD Coin',
      priceUsd: '1.00',
      priceChange24h: 0.1,
      volume24h: 95000000,
      liquidity: 1250000000,
      fdv: 30000000000,
      chainId: 'bsc',
      dexId: 'pancakeswap',
      pairAddress: '0xdef...'
    }
  ];

  async getTrendingTokens(): Promise<Token[]> {
    console.log(chalk.cyan('🔍 Fetching trending tokens (MOCK DATA)...'));
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Add some randomness to make it look real
    const tokens = this.mockTokens.map(token => ({
      ...token,
      priceUsd: (parseFloat(token.priceUsd) * (0.95 + Math.random() * 0.1)).toFixed(2),
      priceChange24h: token.priceChange24h + (Math.random() - 0.5) * 5,
      volume24h: Math.floor(token.volume24h * (0.8 + Math.random() * 0.4))
    }));

    // Add some new random tokens occasionally
    if (Math.random() > 0.7) {
      tokens.push({
        address: `0x${Math.random().toString(16).slice(2, 42)}`,
        symbol: `NEW${Math.floor(Math.random() * 1000)}`,
        name: `New Token ${Math.floor(Math.random() * 1000)}`,
        priceUsd: (Math.random() * 10).toFixed(4),
        priceChange24h: (Math.random() - 0.5) * 100,
        volume24h: Math.floor(Math.random() * 5000000) + 100000,
        liquidity: Math.floor(Math.random() * 10000000) + 50000,
        fdv: Math.floor(Math.random() * 100000000),
        chainId: 'bsc',
        dexId: 'pancakeswap',
        pairAddress: `0x${Math.random().toString(16).slice(2, 42)}`
      });
    }

    console.log(chalk.green(`✅ Found ${tokens.length} trending tokens`));
    return tokens.slice(0, 10);
  }

  async getTokenPrice(address: string): Promise<number> {
    const token = this.mockTokens.find(t => t.address.toLowerCase() === address.toLowerCase());
    if (token) {
      return parseFloat(token.priceUsd) * (0.95 + Math.random() * 0.1);
    }
    return Math.random() * 100;
  }
}