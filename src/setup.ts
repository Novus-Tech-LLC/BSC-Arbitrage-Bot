import { WalletManager } from './services/walletManager';
import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import chalk from 'chalk';
import * as readline from 'readline';
import * as fs from 'fs';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function setupWallets() {
  console.log(chalk.cyan.bold(`
╔══════════════════════════════════════════╗
║     Wallet Setup for $BRIDGE Bot         ║
╚══════════════════════════════════════════╝
`));

  console.log(chalk.yellow('⚠️  SECURITY WARNING: Private keys will be stored locally.'));
  console.log(chalk.yellow('   Make sure to use a dedicated trading wallet, not your main wallet!\n'));

  const choice = await question(`
Choose an option:
1. Import existing wallets (recommended for trading)
2. Generate new wallets (for testing only)
3. Exit

Your choice (1-3): `);

  if (choice === '3') {
    console.log(chalk.yellow('👋 Exiting setup...'));
    process.exit(0);
  }

  const walletManager = new WalletManager();
  let bscPrivateKey: string;
  let solanaPrivateKey: string;

  if (choice === '1') {
    // Import existing wallets
    console.log(chalk.cyan('\n📥 Import BSC Wallet'));
    bscPrivateKey = await question('Enter your BSC private key (without 0x): ');
    
    console.log(chalk.cyan('\n📥 Import Solana Wallet'));
    const solanaInput = await question('Enter your Solana private key (base58 or JSON array): ');
    
    // Handle both base58 and JSON array format
    if (solanaInput.startsWith('[')) {
      solanaPrivateKey = solanaInput;
    } else {
      // Convert base58 to array format
      const keypair = Keypair.fromSecretKey(Buffer.from(solanaInput, 'base64'));
      solanaPrivateKey = JSON.stringify(Array.from(keypair.secretKey));
    }
  } else {
    // Generate new wallets
    console.log(chalk.cyan('\n🔐 Generating new wallets...'));
    
    // Generate BSC wallet
    const bscWallet = ethers.Wallet.createRandom();
    bscPrivateKey = bscWallet.privateKey.substring(2); // Remove 0x prefix
    
    // Generate Solana wallet
    const solanaWallet = Keypair.generate();
    solanaPrivateKey = JSON.stringify(Array.from(solanaWallet.secretKey));
    
    console.log(chalk.green('\n✅ New wallets generated:'));
    console.log(chalk.cyan(`BSC Address: ${bscWallet.address}`));
    console.log(chalk.cyan(`Solana Address: ${solanaWallet.publicKey.toBase58()}`));
    console.log(chalk.red('\n⚠️  SAVE THESE PRIVATE KEYS SECURELY:'));
    console.log(chalk.yellow(`BSC Private Key: ${bscPrivateKey}`));
    console.log(chalk.yellow(`Solana Private Key: ${Buffer.from(solanaWallet.secretKey).toString('base64')}`));
  }

  // Get RPC endpoints
  console.log(chalk.cyan('\n🌐 RPC Configuration'));
  const bscRpc = await question('BSC RPC URL (press Enter for default): ') || 'https://bsc-dataseed1.binance.org';
  const solanaRpc = await question('Solana RPC URL (press Enter for default): ') || 'https://api.mainnet-beta.solana.com';

  // Save configuration
  const config = {
    bsc: {
      address: '',
      privateKey: bscPrivateKey,
      rpcUrl: bscRpc
    },
    solana: {
      address: '',
      privateKey: solanaPrivateKey,
      rpcUrl: solanaRpc
    }
  };

  // Initialize wallets to get addresses
  await walletManager.saveWalletConfig(config);
  const bscWallet = await walletManager.initializeBSC();
  const solanaWallet = await walletManager.initializeSolana();

  if (bscWallet && solanaWallet) {
    config.bsc.address = bscWallet.address;
    config.solana.address = solanaWallet.publicKey.toBase58();
    await walletManager.saveWalletConfig(config);

    console.log(chalk.green('\n✅ Wallet setup complete!'));
    console.log(chalk.cyan('\n📋 Summary:'));
    console.log(`   BSC Wallet: ${config.bsc.address}`);
    console.log(`   Solana Wallet: ${config.solana.address}`);
    console.log(`   Config saved to: wallet.config.json`);
    
    console.log(chalk.yellow('\n⚡ Next steps:'));
    console.log('   1. Fund your BSC wallet with BNB for gas');
    console.log('   2. Fund your Solana wallet with SOL for gas');
    console.log('   3. Update src/config.ts to enable real trading');
    console.log('   4. Run the bot with: npm run start:dev');
  }

  rl.close();
}

// Add to .gitignore
function updateGitignore() {
  const gitignorePath = '.gitignore';
  const walletConfigLine = 'wallet.config.json';
  
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    if (!content.includes(walletConfigLine)) {
      fs.appendFileSync(gitignorePath, `\n${walletConfigLine}`);
      console.log(chalk.green('✅ Added wallet.config.json to .gitignore'));
    }
  }
}

// Run setup
setupWallets().catch(console.error);
updateGitignore();