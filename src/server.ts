import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import path from 'path';
import { TradingBot } from './services/tradingBot';
import { config } from './config';
import chalk from 'chalk';

export class Server {
  private app: express.Application;
  private wss: WebSocketServer;
  private bot: TradingBot;
  private clients: Set<any> = new Set();

  constructor() {
    this.app = express();
    this.wss = new WebSocketServer({ port: config.server.wsPort });
    this.bot = new TradingBot();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupBotListeners();
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '..', 'public')));
  }

  private setupRoutes() {
    this.app.get('/api/status', (req, res) => {
      res.json(this.bot.getStatus());
    });

    this.app.post('/api/bot/start', (req, res) => {
      this.bot.start();
      res.json({ success: true, message: 'Bot started' });
    });

    this.app.post('/api/bot/stop', (req, res) => {
      this.bot.stop();
      res.json({ success: true, message: 'Bot stopped' });
    });

    this.app.get('/api/trending', (req, res) => {
      res.json(this.bot.getTrendingTokens());
    });

    this.app.get('/api/narratives', (req, res) => {
      res.json(this.bot.getNarrativeScores());
    });

    this.app.get('/api/pump-analyses', (req, res) => {
      res.json(this.bot.getPumpAnalyses());
    });

    this.app.get('/api/claude-analyses', (req, res) => {
      res.json(this.bot.getClaudeAnalyses());
    });

    this.app.get('/api/research', (req, res) => {
      res.json(this.bot.getResearchHistory());
    });

    this.app.post('/api/analyze-token/:address', async (req, res) => {
      const { address } = req.params;
      const analysis = await this.bot.analyzeSpecificToken(address);
      if (analysis) {
        res.json(analysis);
      } else {
        res.status(404).json({ error: 'Token not found' });
      }
    });
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log(chalk.green('✅ New WebSocket client connected'));
      this.clients.add(ws);

      // Send initial status
      ws.send(JSON.stringify({
        type: 'status',
        data: this.bot.getStatus(),
      }));

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(chalk.yellow('👋 WebSocket client disconnected'));
      });

      ws.on('error', (error) => {
        console.error(chalk.red('WebSocket error:'), error);
      });
    });
  }

  private setupBotListeners() {
    this.bot.addEventListener((event, data) => {
      this.broadcast({
        type: event,
        data,
        timestamp: new Date(),
      });
    });
  }

  private broadcast(message: any) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(messageStr);
      }
    });
  }

  start() {
    this.app.listen(config.server.port, () => {
      console.log(chalk.cyan(`🚀 Server running on http://localhost:${config.server.port}`));
      console.log(chalk.cyan(`📡 WebSocket server on ws://localhost:${config.server.wsPort}`));
      
      // Auto-start the trading bot
      console.log(chalk.green('🤖 Auto-starting trading bot...'));
      this.bot.start();
    });
  }
}