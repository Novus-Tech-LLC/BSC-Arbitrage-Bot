import { ethers } from 'ethers';
import { WalletManager } from './walletManager';
import { Token } from '../types';
import { SwapParams, TransactionResult } from '../types/web3';
import chalk from 'chalk';
import axios from 'axios';

const PANCAKESWAP_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const BUSD_ADDRESS = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';

export class PancakeSwapTrading {
  private walletManager: WalletManager;
  private routerContract: ethers.Contract | null = null;
  private slippage: number = 0.5; // 0.5% default slippage

  constructor(walletManager: WalletManager) {
    this.walletManager = walletManager;
    this.initializeRouter();
  }

  private initializeRouter() {
    const wallet = this.walletManager.getBSCWallet();
    if (!wallet) return;

    const routerAbi = [
      'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
      'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
      'function WETH() external pure returns (address)'
    ];

    this.routerContract = new ethers.Contract(PANCAKESWAP_ROUTER, routerAbi, wallet);
  }

  async buyToken(token: Token, bnbAmount: number): Promise<TransactionResult | null> {
    try {
      const wallet = this.walletManager.getBSCWallet();
      const provider = this.walletManager.getBSCProvider();
      if (!wallet || !provider || !this.routerContract) {
        throw new Error('Wallet or router not initialized');
      }

      console.log(chalk.cyan(`🛒 Buying ${token.symbol} with ${bnbAmount} BNB...`));

      // Check balance
      const balance = await provider.getBalance(wallet.address);
      const amountInWei = ethers.parseEther(bnbAmount.toString());
      
      if (balance < amountInWei) {
        throw new Error('Insufficient BNB balance');
      }

      // Get expected output
      const path = [WBNB_ADDRESS, token.address];
      const amounts = await this.routerContract.getAmountsOut(amountInWei, path);
      const amountOutMin = amounts[1] * BigInt(100 - this.slippage * 100) / BigInt(100);

      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

      // Estimate gas
      const gasEstimate = await this.routerContract.swapExactETHForTokens.estimateGas(
        amountOutMin,
        path,
        wallet.address,
        deadline,
        { value: amountInWei }
      );

      const gasPrice = (await provider.getFeeData()).gasPrice;
      const gasCost = gasEstimate * gasPrice!;

      console.log(chalk.yellow(`⛽ Estimated gas: ${ethers.formatEther(gasCost)} BNB`));

      // Execute swap
      const tx = await this.routerContract.swapExactETHForTokens(
        amountOutMin,
        path,
        wallet.address,
        deadline,
        { 
          value: amountInWei,
          gasLimit: gasEstimate * BigInt(120) / BigInt(100), // 20% buffer
          gasPrice: gasPrice
        }
      );

      console.log(chalk.green(`📤 Transaction sent: ${tx.hash}`));
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      console.log(chalk.green(`✅ Buy successful! Block: ${receipt.blockNumber}`));

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.gasPrice,
        status: receipt.status === 1
      };

    } catch (error: any) {
      console.error(chalk.red(`❌ Buy failed: ${error.message}`));
      return null;
    }
  }

  async sellToken(token: Token, tokenAmount: number): Promise<TransactionResult | null> {
    try {
      const wallet = this.walletManager.getBSCWallet();
      const provider = this.walletManager.getBSCProvider();
      if (!wallet || !provider || !this.routerContract) {
        throw new Error('Wallet or router not initialized');
      }

      console.log(chalk.cyan(`💸 Selling ${tokenAmount} ${token.symbol}...`));

      // Setup token contract
      const tokenAbi = [
        'function approve(address spender, uint256 amount) external returns (bool)',
        'function allowance(address owner, address spender) external view returns (uint256)',
        'function balanceOf(address account) external view returns (uint256)',
        'function decimals() external view returns (uint8)'
      ];

      const tokenContract = new ethers.Contract(token.address, tokenAbi, wallet);
      const decimals = await tokenContract.decimals();
      const amountIn = ethers.parseUnits(tokenAmount.toString(), decimals);

      // Check balance
      const balance = await tokenContract.balanceOf(wallet.address);
      if (balance < amountIn) {
        throw new Error('Insufficient token balance');
      }

      // Check and set approval
      const allowance = await tokenContract.allowance(wallet.address, PANCAKESWAP_ROUTER);
      if (allowance < amountIn) {
        console.log(chalk.yellow('🔓 Approving token...'));
        const approveTx = await tokenContract.approve(PANCAKESWAP_ROUTER, ethers.MaxUint256);
        await approveTx.wait();
      }

      // Get expected output
      const path = [token.address, WBNB_ADDRESS];
      const amounts = await this.routerContract.getAmountsOut(amountIn, path);
      const amountOutMin = amounts[1] * BigInt(100 - this.slippage * 100) / BigInt(100);

      // Set deadline
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

      // Execute swap
      const tx = await this.routerContract.swapExactTokensForETH(
        amountIn,
        amountOutMin,
        path,
        wallet.address,
        deadline
      );

      console.log(chalk.green(`📤 Transaction sent: ${tx.hash}`));
      
      const receipt = await tx.wait();
      
      console.log(chalk.green(`✅ Sell successful! Block: ${receipt.blockNumber}`));

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.gasPrice,
        status: receipt.status === 1
      };

    } catch (error: any) {
      console.error(chalk.red(`❌ Sell failed: ${error.message}`));
      return null;
    }
  }

  async getTokenPrice(tokenAddress: string): Promise<number> {
    try {
      if (!this.routerContract) return 0;

      const path = [tokenAddress, WBNB_ADDRESS, BUSD_ADDRESS];
      const amountIn = ethers.parseUnits('1', 18); // 1 token
      
      const amounts = await this.routerContract.getAmountsOut(amountIn, path);
      const priceInBUSD = ethers.formatUnits(amounts[amounts.length - 1], 18);
      
      return parseFloat(priceInBUSD);
    } catch (error) {
      // If direct path fails, try through WBNB only
      try {
        const path = [tokenAddress, WBNB_ADDRESS];
        const amountIn = ethers.parseUnits('1', 18);
        const amounts = await this.routerContract!.getAmountsOut(amountIn, path);
        
        // Get BNB price in USD
        const bnbPrice = await this.getBNBPrice();
        const priceInBNB = ethers.formatUnits(amounts[1], 18);
        
        return parseFloat(priceInBNB) * bnbPrice;
      } catch {
        return 0;
      }
    }
  }

  private async getBNBPrice(): Promise<number> {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT');
      return parseFloat(response.data.price);
    } catch {
      return 500; // Fallback price
    }
  }

  setSlippage(slippagePercent: number) {
    this.slippage = slippagePercent;
    console.log(chalk.cyan(`⚙️  Slippage set to ${slippagePercent}%`));
  }
}