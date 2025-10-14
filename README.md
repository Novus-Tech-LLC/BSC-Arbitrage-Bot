 # BSC Arbitrage & Demo Trading Bot

 A demonstration-grade trading bot and real-time dashboard focused on Binance Smart Chain (BSC) token monitoring, research, and paper trading. This repository is intended for demos, experimentation, and learning — paper trading is the default and real trading requires explicit configuration and code review.

Table of contents

- Features
- Requirements
- Quick start (Windows PowerShell)
- Configuration & environment
- Development scripts
- Project layout
- Architecture notes
- Troubleshooting
- Contributing
- License & next steps

## Features

- Real-time token scanning (DexScreener integration)
- Paper trading engine with simulated P&L and adjustable starting capital
- Modular trading services (paper and real trading engines are isolated)
- WebSocket-backed dashboard for live telemetry and controls
- Demo-ready flows and UI for livestream presentation

## Requirements

- Node.js 18+ (LTS recommended)
- npm (or pnpm)
- Internet access for market data APIs (DexScreener, optional CoinGecko)

## Quick start (Windows PowerShell)

1. Clone the repository and open PowerShell in the project root.

2. Install dependencies:

```powershell
npm install
```

3. Start the development server and dashboard:

```powershell
npm run start:dev
```

4. Open http://localhost:3000 in your browser.

5. Use the dashboard "START BOT" button to begin paper trading (safe default).

## Configuration & environment

- Primary runtime options live in `src/config.ts`.
- Use a `.env` file for secrets (see `.env.sample` added to the repo).
- Important settings to review:
	- `tradingEnabled` (boolean) — enables real order execution (default: false)
	- `paperStartingBalance` — starting capital for the paper trading engine
	- `scanIntervalSec` — frequency for market scans in seconds

Keep API keys and private keys out of version control. Use your platform's secrets manager for production.

## Development & scripts

- `npm run start:dev` — start server in development mode
- `npm run build` — compile TypeScript
- `npm run start` — run production build
- `npm test` — run tests (if present)

## Project layout (high level)

```
├── src/                 # TypeScript source
│   ├── index.ts         # App bootstrap
│   ├── server.ts        # Express + WebSocket server
│   ├── config.ts        # Central configuration
│   ├── services/        # Trading and data services
│   └── types/           # Shared types/interfaces
├── public/              # Dashboard files and demo scripts
├── package.json
└── README.md
```

## Architecture notes

- The codebase is organized into modular services under `src/services/` so integrations (DexScreener, PancakeSwap helpers, real trading engine) can be swapped or extended.
- Telemetry and market updates are pushed to the dashboard via WebSocket.
- Paper trading is enabled by default. Review `src/services/realTradingEngine.ts` and validate credentials before enabling live trading.

## Troubleshooting

- Port already in use: change the port in `src/config.ts` or stop the conflicting process.
- No tokens appearing: the data provider may be rate-limited or down. Try again later or switch data sources in `src/services/`.
- WebSocket disconnects: check server logs; the dashboard should attempt auto-reconnects.

## Contributing

See `CONTRIBUTING.md` for contribution guidelines. In short:

- Open issues for bugs or feature requests.
- Create feature branches `feature/<short-desc>`.
- Add tests for new behavior and keep changes focused.

## License & next steps

- A `LICENSE` (MIT) is included in this repository.
- Suggested follow-ups:
	- Add CI for linting/build/tests and badges in this README
	- Add more unit tests for core services
	- Add enhanced docs for deployment and production settings

## Contact

| Platform | Link |
|----------|------|
| 📱 Telegram | [t.me/novustch](https://t.me/novustch) |
| 📲 WhatsApp | [wa.me/14105015750](https://wa.me/14105015750) |
| 💬 Discord | [discordapp.com/users/985432160498491473](https://discordapp.com/users/985432160498491473)

<div align="center">
    <a href="https://t.me/novustch" target="_blank"><img alt="Telegram"
        src="https://img.shields.io/badge/Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white"/></a>
    <a href="https://wa.me/14105015750" target="_blank"><img alt="WhatsApp"
        src="https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white"/></a>
    <a href="https://discordapp.com/users/985432160498491473" target="_blank"><img alt="Discord"
        src="https://img.shields.io/badge/Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white"/></a>
</div>

For commercial support or custom integrations, contact Novus Tech LLC.
