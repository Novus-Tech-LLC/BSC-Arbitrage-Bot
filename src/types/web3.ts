import { BigNumberish } from 'ethers';

export interface WalletConfig {
  bsc: {
    address: string;
    privateKey: string;
    rpcUrl: string;
  };
  solana: {
    address: string;
    privateKey: string;
    rpcUrl: string;
  };
}

export interface TokenContract {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
}

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumberish;
  slippage: number;
  deadline: number;
  recipient: string;
}

export interface TransactionResult {
  hash: string;
  blockNumber: number;
  gasUsed: BigNumberish;
  effectiveGasPrice: BigNumberish;
  status: boolean;
}

export interface PancakeSwapRoute {
  path: string[];
  pairs: string[];
  amountOut: BigNumberish;
  priceImpact: number;
}