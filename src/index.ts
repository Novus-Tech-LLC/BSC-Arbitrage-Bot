import { Server } from './server';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log(chalk.cyan.bold(`
╔══════════════════════════════════════════╗
║       $BRIDGE Token Trading Bot          ║
║         Berkeley CS Edition              ║
╚══════════════════════════════════════════╝
`));

console.log(chalk.green('🚀 Starting Cross-Chain Trading Bot...'));
console.log(chalk.yellow('⚠️  Running in PAPER TRADING mode'));
console.log(chalk.cyan('📊 Dashboard: http://localhost:3000\n'));

const server = new Server();
server.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Shutting down gracefully...'));
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  console.error(chalk.red('❌ Unhandled rejection:'), error);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('❌ Uncaught exception:'), error);
  process.exit(1);
});