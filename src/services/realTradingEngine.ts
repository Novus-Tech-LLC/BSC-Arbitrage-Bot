import { Token, Position, Trade } from '../types';
import { PancakeSwapTrading } from './pancakeswapTrading';
import { WalletManager } from './walletManager';
import { DexScreenerService } from './dexscreener';
import { config } from '../config';
import chalk from 'chalk';
import { ethers } from 'ethers';

interface RealPosition extends Position {
  txHash: string;
  gasUsed: string;
  realizedPnl?: number;
}

export class RealTradingEngine {
  private walletManager: WalletManager;
  private pancakeSwap: PancakeSwapTrading;
  private dexScreener: DexScreenerService;
  private positions: Map<string, RealPosition> = new Map();
  private isLive: boolean = false;
  private bnbBalance: number = 0;
  private totalRealizedPnl: number = 0;

  constructor() {
    this.walletManager = new WalletManager();
    this.pancakeSwap = new PancakeSwapTrading(this.walletManager);
    this.dexScreener = new DexScreenerService();
  }

  async initialize(privateKey?: string) {
    try {
      await this.walletManager.initializeBSC(privateKey);
      await this.updateBalance();
      this.isLive = true;
      console.log(chalk.green('✅ Real trading engine initialized'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize trading engine:'), error);
      return false;
    }
  }

  async updateBalance() {
    const wallet = this.walletManager.getBSCWallet();
    const provider = this.walletManager.getBSCProvider();
    
    if (!wallet || !provider) return;

    const balance = await provider.getBalance(wallet.address);
    this.bnbBalance = parseFloat(ethers.formatEther(balance));
    console.log(chalk.cyan(`💰 BNB Balance: ${this.bnbBalance.toFixed(4)} BNB`));
  }

  async executeBuy(token: Token): Promise<Trade | null> {
    if (!this.isLive) {
      console.log(chalk.yellow('⚠️  Trading engine not live'));
      return null;
    }

    // Calculate position size
    const positionSizeBNB = this.calculatePositionSize();
    if (positionSizeBNB <= 0) {
      console.log(chalk.yellow('⚠️  Insufficient balance for new position'));
      return null;
    }

    // Execute buy on PancakeSwap
    const result = await this.pancakeSwap.buyToken(token, positionSizeBNB);
    if (!result) return null;

    // Get actual token amount from transaction logs
    const tokenAmount = await this.getTokenAmountFromTx(result.hash, token.address);

    // Create position record
    const position: RealPosition = {
      id: result.hash,
      token,
      entryPrice: parseFloat(token.priceUsd),
      currentPrice: parseFloat(token.priceUsd),
      quantity: tokenAmount,
      usdValue: positionSizeBNB * (await this.getBNBPrice()),
      pnl: 0,
      pnlPercent: 0,
      timestamp: new Date(),
      entryTime: new Date(),
      status: 'open',
      txHash: result.hash,
      gasUsed: '0' // Will calculate from receipt later
    };

    this.positions.set(position.id, position);

    // Update balance
    await this.updateBalance();

    // Create trade record
    const trade: Trade = {
      id: result.hash,
      tokenSymbol: token.symbol,
      tokenAddress: token.address,
      type: 'buy',
      price: position.entryPrice,
      quantity: tokenAmount,
      usdValue: position.usdValue,
      timestamp: new Date(),
      reason: 'High volume trending token'
    };

    return trade;
  }

  async executeSell(positionId: string, reason: string): Promise<Trade | null> {
    const position = this.positions.get(positionId);
    if (!position || position.status === 'closed') return null;

    // Get current price
    const currentPrice = await this.pancakeSwap.getTokenPrice(position.token.address);
    if (currentPrice <= 0) {
      console.log(chalk.yellow('⚠️  Could not fetch current price'));
      return null;
    }

    // Execute sell on PancakeSwap
    const result = await this.pancakeSwap.sellToken(position.token, position.quantity);
    if (!result) return null;

    // Calculate realized PnL
    const bnbReceived = await this.getBNBFromTx(result.hash);
    const bnbPrice = await this.getBNBPrice();
    const sellValue = bnbReceived * bnbPrice;
    const realizedPnl = sellValue - position.usdValue;
    const pnlPercent = (realizedPnl / position.usdValue) * 100;

    // Update position
    position.status = 'closed';
    position.exitPrice = currentPrice;
    position.exitTimestamp = new Date();
    position.realizedPnl = realizedPnl;
    position.pnl = realizedPnl;
    position.pnlPercent = pnlPercent;

    this.totalRealizedPnl += realizedPnl;

    // Update balance
    await this.updateBalance();

    // Create trade record
    const trade: Trade = {
      id: result.hash,
      tokenSymbol: position.token.symbol,
      tokenAddress: position.token.address,
      type: 'sell',
      price: currentPrice,
      quantity: position.quantity,
      usdValue: sellValue,
      timestamp: new Date(),
      pnl: realizedPnl,
      reason
    };

    const color = realizedPnl > 0 ? chalk.green : chalk.red;
    console.log(color(`💸 SOLD ${position.token.symbol} | PNL: ${realizedPnl > 0 ? '+' : ''}$${realizedPnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`));

    return trade;
  }

  async checkStopLossAndTakeProfit() {
    for (const [id, position] of this.positions) {
      if (position.status !== 'open') continue;

      const currentPrice = await this.pancakeSwap.getTokenPrice(position.token.address);
      if (currentPrice <= 0) continue;

      const priceChange = (currentPrice - position.entryPrice) / position.entryPrice;

      // Check stop loss
      if (priceChange <= -0.05) { // 5% loss
        console.log(chalk.red(`🛑 Stop loss triggered for ${position.token.symbol}`));
        await this.executeSell(id, 'Stop loss triggered');
      }
      // Check take profit
      else if (priceChange >= 0.15) { // 15% profit
        console.log(chalk.green(`🎯 Take profit triggered for ${position.token.symbol}`));
        await this.executeSell(id, 'Take profit triggered');
      }

      // Update current position values
      position.currentPrice = currentPrice;
      const currentValue = position.quantity * currentPrice;
      position.pnl = currentValue - position.usdValue;
      position.pnlPercent = (position.pnl / position.usdValue) * 100;
    }
  }

  private calculatePositionSize(): number {
    // Use 2% of available BNB balance per trade
    const maxPosition = this.bnbBalance * 0.02;
    const minPosition = 0.01; // Minimum 0.01 BNB

    if (maxPosition < minPosition) return 0;
    
    // Also check against config
    const bnbPrice = 300; // Approximate, should fetch real price
    const configMaxUSD = config.bot.positionSize;
    const configMaxBNB = configMaxUSD / bnbPrice;

    return Math.min(maxPosition, configMaxBNB);
  }

  private async getTokenAmountFromTx(txHash: string, tokenAddress: string): Promise<number> {
    // This would parse transaction logs to get exact token amount received
    // For now, return estimated amount
    return 1000; // Placeholder
  }

  private async getBNBFromTx(txHash: string): Promise<number> {
    // This would parse transaction logs to get exact BNB received
    // For now, return estimated amount
    return 0.1; // Placeholder
  }

  private async getBNBPrice(): Promise<number> {
    try {
      const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT');
      const data = await response.json() as { price: string };
      return parseFloat(data.price);
    } catch {
      return 300; // Fallback
    }
  }

  getStats() {
    const openPositions = Array.from(this.positions.values()).filter(p => p.status === 'open');
    const closedPositions = Array.from(this.positions.values()).filter(p => p.status === 'closed');
    const winningTrades = closedPositions.filter(p => p.realizedPnl && p.realizedPnl > 0).length;
    
    return {
      isLive: this.isLive,
      bnbBalance: this.bnbBalance,
      totalRealizedPnl: this.totalRealizedPnl,
      openPositions: openPositions.length,
      totalTrades: closedPositions.length,
      winRate: closedPositions.length > 0 ? (winningTrades / closedPositions.length) * 100 : 0
    };
  }
}