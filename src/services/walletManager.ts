import { ethers } from 'ethers';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { WalletConfig, TransactionResult } from '../types/web3';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

export class WalletManager {
  private bscWallet: ethers.Wallet | null = null;
  private bscProvider: ethers.JsonRpcProvider | null = null;
  private solanaWallet: Keypair | null = null;
  private solanaConnection: Connection | null = null;
  private config: WalletConfig | null = null;

  constructor() {
    this.loadWalletConfig();
  }

  private loadWalletConfig() {
    try {
      const configPath = path.join(process.cwd(), 'wallet.config.json');
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf-8');
        this.config = JSON.parse(configData);
        console.log(chalk.green('✅ Wallet configuration loaded'));
      } else {
        console.log(chalk.yellow('⚠️  No wallet configuration found. Run setup first.'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Error loading wallet config:'), error);
    }
  }

  async initializeBSC(privateKey?: string, rpcUrl?: string) {
    try {
      const key = privateKey || this.config?.bsc.privateKey;
      const rpc = rpcUrl || this.config?.bsc.rpcUrl || 'https://bsc-dataseed1.binance.org';
      
      if (!key) {
        throw new Error('BSC private key not provided');
      }

      this.bscProvider = new ethers.JsonRpcProvider(rpc);
      this.bscWallet = new ethers.Wallet(key, this.bscProvider);
      
      const balance = await this.bscProvider.getBalance(this.bscWallet.address);
      console.log(chalk.green(`✅ BSC wallet connected: ${this.bscWallet.address}`));
      console.log(chalk.cyan(`   Balance: ${ethers.formatEther(balance)} BNB`));
      
      return this.bscWallet;
    } catch (error) {
      console.error(chalk.red('❌ BSC initialization error:'), error);
      throw error;
    }
  }

  async initializeSolana(privateKey?: string, rpcUrl?: string) {
    try {
      const key = privateKey || this.config?.solana.privateKey;
      const rpc = rpcUrl || this.config?.solana.rpcUrl || 'https://api.mainnet-beta.solana.com';
      
      if (!key) {
        throw new Error('Solana private key not provided');
      }

      const secretKey = Uint8Array.from(JSON.parse(key));
      this.solanaWallet = Keypair.fromSecretKey(secretKey);
      this.solanaConnection = new Connection(rpc, 'confirmed');
      
      const balance = await this.solanaConnection.getBalance(this.solanaWallet.publicKey);
      console.log(chalk.green(`✅ Solana wallet connected: ${this.solanaWallet.publicKey.toBase58()}`));
      console.log(chalk.cyan(`   Balance: ${balance / 1e9} SOL`));
      
      return this.solanaWallet;
    } catch (error) {
      console.error(chalk.red('❌ Solana initialization error:'), error);
      throw error;
    }
  }

  async checkBSCBalance(tokenAddress?: string): Promise<string> {
    if (!this.bscWallet || !this.bscProvider) {
      throw new Error('BSC wallet not initialized');
    }

    if (!tokenAddress) {
      const balance = await this.bscProvider.getBalance(this.bscWallet.address);
      return ethers.formatEther(balance);
    }

    const tokenAbi = [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)'
    ];
    
    const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, this.bscProvider);
    const [balance, decimals, symbol] = await Promise.all([
      tokenContract.balanceOf(this.bscWallet.address),
      tokenContract.decimals(),
      tokenContract.symbol()
    ]);
    
    return `${ethers.formatUnits(balance, decimals)} ${symbol}`;
  }

  async estimateGasBSC(to: string, data: string): Promise<{ gasLimit: bigint; gasPrice: bigint }> {
    if (!this.bscWallet || !this.bscProvider) {
      throw new Error('BSC wallet not initialized');
    }

    const gasLimit = await this.bscProvider.estimateGas({
      from: this.bscWallet.address,
      to,
      data
    });

    const gasPrice = await this.bscProvider.getFeeData();
    
    return {
      gasLimit,
      gasPrice: gasPrice.gasPrice || BigInt(5000000000) // 5 gwei default
    };
  }

  getBSCWallet(): ethers.Wallet | null {
    return this.bscWallet;
  }

  getBSCProvider(): ethers.JsonRpcProvider | null {
    return this.bscProvider;
  }

  getSolanaWallet(): Keypair | null {
    return this.solanaWallet;
  }

  getSolanaConnection(): Connection | null {
    return this.solanaConnection;
  }

  async saveWalletConfig(config: WalletConfig) {
    try {
      const configPath = path.join(process.cwd(), 'wallet.config.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      this.config = config;
      console.log(chalk.green('✅ Wallet configuration saved'));
    } catch (error) {
      console.error(chalk.red('❌ Error saving wallet config:'), error);
      throw error;
    }
  }
}