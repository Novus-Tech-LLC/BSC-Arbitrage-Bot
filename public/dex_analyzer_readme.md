# DexScreener Hourly Analysis Bot

An automated crypto analysis bot that finds tokens similar to DUST and PRICELESS, with hourly updates, live price tracking, and intelligent notifications.

## Features

- **Token Similarity Detection**: Finds tokens matching DUST and PRICELESS profiles
- **Hourly Analysis**: Comprehensive market analysis every hour
- **Live Price Tracking**: Real-time price monitoring with alerts
- **Smart Notifications**: Console and file-based alerts for opportunities
- **Risk Assessment**: Evaluates tokens based on liquidity, volatility, and age
- **Opportunity Scoring**: Ranks tokens from 0-100 based on potential

## Installation

```bash
pip install -r requirements.txt
```

## Usage

### Basic Usage
```bash
python dex_analyzer_main.py
```

### Test Mode (1-minute intervals)
```bash
python dex_analyzer_main.py --test-mode
```

### Console Only (no file outputs)
```bash
python dex_analyzer_main.py --console-only
```

### Without Price Tracking
```bash
python dex_analyzer_main.py --no-price-tracking
```

## Configuration

Create a `config.json` file to customize settings:

```json
{
    "console_notifications": true,
    "file_notifications": true,
    "notification_dir": "./notifications",
    "report_dir": "./reports",
    "print_summary": true,
    "enable_price_tracking": true,
    "track_trending": true,
    "test_mode": false,
    "notification_filters": {
        "min_opportunity_score": 70,
        "max_risk_level": "high",
        "min_price_change": 20,
        "min_volume_spike": 2.0
    }
}
```

## Token Profiles

### DUST-like Tokens
- Market Cap: $1M - $50M
- Volume/MCap Ratio: 0.5 - 3.0
- High volatility
- Minimum liquidity: $100k

### PRICELESS-like Tokens
- Market Cap: $500k - $20M
- Volume/MCap Ratio: 1.0 - 5.0
- Very high volatility
- Minimum liquidity: $50k

## Output

### Hourly Reports
- Saved to `./reports/analysis_YYYYMMDD_HHMMSS.json`
- Contains detailed analysis of all found tokens

### Notifications
- Console alerts for high-opportunity tokens
- File notifications in `./notifications/`
- Price movement alerts (pumps/dumps)
- New gem discoveries

## Risk Levels

- **Low**: Established tokens with good liquidity
- **Medium**: Moderate risk, reasonable liquidity
- **High**: New or volatile tokens
- **Extreme**: Very new tokens with low liquidity

## Opportunity Scoring

Tokens are scored 0-100 based on:
- Volume activity (30 points)
- Price momentum (20 points)
- Liquidity health (20 points)
- Market cap sweet spot (30 points)

## Stop the Bot

Press `Ctrl+C` to gracefully stop the bot.