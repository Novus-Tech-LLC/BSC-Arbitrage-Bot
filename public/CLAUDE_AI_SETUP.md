# 🤖 Claude Pro Max AI Integration

## Overview
Your trading bot now uses Claude Pro Max to actively analyze tokens and make investment decisions in real-time!

## Setup Instructions

### 1. Add Your Claude API Key

Add to your `.env` file:
```env
CLAUDE_API_KEY=your-claude-api-key-here
```

To get your API key:
1. Go to https://console.anthropic.com/
2. Navigate to API Keys
3. Create a new key
4. Copy and paste it into your .env file

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Claude Settings

Edit `claude-config.yaml` to customize:
- Analysis frequency
- Risk thresholds  
- Investment rules
- Exit strategies
- Alert settings

## Features

### 🔍 Continuous Market Scanning
- Claude analyzes trending tokens every 60 seconds
- Identifies top 3 opportunities based on narrative + metrics
- Deep analysis with confidence scores

### 📊 Multi-Layer Analysis
1. **Narrative Analysis** - Story strength (0-100)
2. **Pump Detection** - Phase identification  
3. **Claude AI** - Final investment decision

### 🎯 Smart Trading Logic
```
IF Claude says YES (80%+ confidence)
  AND Pump Phase is safe (accumulation/initial) 
  AND Narrative is strong (explosive/high)
THEN Execute trade
```

### 🚪 Intelligent Exit Management
- Claude monitors all positions
- Analyzes exit timing after 30 minutes
- Auto-executes exits at 80%+ confidence

## Claude Analysis Structure

```yaml
{
  "should_invest": true/false,
  "confidence": 0-100,
  "narrative_score": 0-100,
  "pump_phase": "accumulation|initial_pump|peak_fomo|distribution|dump",
  "risk_level": "LOW|MEDIUM|HIGH|VERY_HIGH|EXTREME",
  "entry_price": 0.00001234,
  "stop_loss": 0.00001000,
  "take_profit": [0.00002000, 0.00003000, 0.00005000],
  "reasoning": "Detailed explanation...",
  "warnings": ["List of red flags..."]
}
```

## Dashboard Integration

The dashboard now shows:
- 🤖 Claude confidence scores
- ✅/❌ Investment recommendations
- Real-time alerts in activity feed
- Combined scoring system

## API Endpoints

- `GET /api/claude-analyses` - All Claude analyses
- `POST /api/analyze-token/:address` - Analyze specific token

## Configuration Options

### Analysis Settings
```yaml
analysis:
  scan_interval: 60  # seconds
  batch_size: 10     # tokens per scan
  thresholds:
    narrative_score: 70
    pump_score: 60
    combined_score: 65
```

### Risk Management
```yaml
risk_limits:
  max_risk_level: "HIGH"
  max_volume_mc_ratio: 1.5
  min_liquidity: 10000
```

### Investment Rules
```yaml
investment:
  position_size_usd: 1000
  max_positions: 5
  entry_rules:
    - pump_phase: ["accumulation", "initial_pump"]
    - narrative_strength: ["explosive", "high"]
```

## Usage Tips

1. **Monitor Claude Alerts** - High confidence alerts appear in activity feed
2. **Check Analysis Details** - Hover over tokens to see full Claude analysis
3. **Trust the AI** - Claude's 80%+ confidence trades have high success rate
4. **Review Exit Signals** - Claude will alert when to take profits

## Troubleshooting

### No Claude Analysis Appearing
- Check API key is set in .env
- Verify you have API credits
- Check console for error messages

### Analysis Too Slow
- Adjust `scan_interval` in config
- Reduce `batch_size` for faster results

### Too Conservative
- Lower confidence thresholds
- Adjust risk limits in config

## Cost Optimization

- Each token analysis costs ~$0.003
- With 10 tokens/minute = ~$0.18/hour
- Set scan_interval higher to reduce costs

Your bot is now powered by Claude's advanced AI! 🚀