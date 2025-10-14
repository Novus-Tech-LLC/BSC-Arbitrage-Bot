import json
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict, field
import asyncio
import aiofiles
import logging

logger = logging.getLogger(__name__)

@dataclass
class Position:
    token_symbol: str
    token_address: str
    entry_price: float
    current_price: float
    quantity: float
    entry_time: datetime
    position_value_usd: float = 0
    pnl_usd: float = 0
    pnl_percent: float = 0
    
    def update_price(self, new_price: float):
        """Update current price and calculate P&L"""
        self.current_price = new_price
        self.position_value_usd = self.quantity * self.current_price
        cost_basis = self.quantity * self.entry_price
        self.pnl_usd = self.position_value_usd - cost_basis
        self.pnl_percent = (self.pnl_usd / cost_basis) * 100 if cost_basis > 0 else 0

@dataclass
class Trade:
    timestamp: datetime
    action: str  # 'buy' or 'sell'
    token_symbol: str
    token_address: str
    price: float
    quantity: float
    value_usd: float
    reason: str
    
@dataclass
class Portfolio:
    starting_balance: float = 1000.0
    current_balance: float = 1000.0
    positions: Dict[str, Position] = field(default_factory=dict)
    trade_history: List[Trade] = field(default_factory=list)
    total_realized_pnl: float = 0
    total_unrealized_pnl: float = 0
    win_count: int = 0
    loss_count: int = 0
    
    def add_position(self, position: Position):
        """Add a new position to portfolio"""
        self.positions[position.token_address] = position
        self.current_balance -= position.quantity * position.entry_price
        
        trade = Trade(
            timestamp=position.entry_time,
            action='buy',
            token_symbol=position.token_symbol,
            token_address=position.token_address,
            price=position.entry_price,
            quantity=position.quantity,
            value_usd=position.quantity * position.entry_price,
            reason='Initial position'
        )
        self.trade_history.append(trade)
        
    def close_position(self, token_address: str, sell_price: float, reason: str = "Take profit"):
        """Close a position and realize P&L"""
        if token_address not in self.positions:
            return False
            
        position = self.positions[token_address]
        position.update_price(sell_price)
        
        # Update portfolio stats
        self.current_balance += position.position_value_usd
        self.total_realized_pnl += position.pnl_usd
        
        if position.pnl_usd > 0:
            self.win_count += 1
        else:
            self.loss_count += 1
            
        # Record trade
        trade = Trade(
            timestamp=datetime.utcnow(),
            action='sell',
            token_symbol=position.token_symbol,
            token_address=position.token_address,
            price=sell_price,
            quantity=position.quantity,
            value_usd=position.position_value_usd,
            reason=reason
        )
        self.trade_history.append(trade)
        
        # Remove position
        del self.positions[token_address]
        return True
        
    def update_all_prices(self, price_updates: Dict[str, float]):
        """Update all position prices"""
        self.total_unrealized_pnl = 0
        
        for address, position in self.positions.items():
            if address in price_updates:
                position.update_price(price_updates[address])
                self.total_unrealized_pnl += position.pnl_usd
                
    def get_total_value(self) -> float:
        """Get total portfolio value"""
        positions_value = sum(p.position_value_usd for p in self.positions.values())
        return self.current_balance + positions_value
        
    def get_total_pnl(self) -> float:
        """Get total P&L (realized + unrealized)"""
        return self.total_realized_pnl + self.total_unrealized_pnl
        
    def get_roi(self) -> float:
        """Get return on investment percentage"""
        return ((self.get_total_value() - self.starting_balance) / self.starting_balance) * 100
        
    def get_win_rate(self) -> float:
        """Get win rate percentage"""
        total_trades = self.win_count + self.loss_count
        return (self.win_count / total_trades) * 100 if total_trades > 0 else 0

class PortfolioManager:
    def __init__(self, starting_balance: float = 1000.0):
        self.portfolio = Portfolio(starting_balance=starting_balance, current_balance=starting_balance)
        self.max_positions = 10
        self.position_size_percent = 10  # 10% of balance per position
        
    def initialize_demo_positions(self):
        """Initialize with some demo positions"""
        demo_positions = [
            {
                'symbol': 'DUST',
                'address': '0xb5b9dEd77E24263Bb5996D66749BBc88CB89Bd7F',
                'entry_price': 0.000245,
                'current_price': 0.000312,
                'quantity': 1632653,  # ~$400 worth
                'entry_time': datetime.utcnow()
            },
            {
                'symbol': 'PRICELESS',
                'address': '0x892d50AdaA07073C640C0bABE74c85Dd89edE8F0',
                'entry_price': 0.00000891,
                'current_price': 0.00001156,
                'quantity': 33707865,  # ~$300 worth
                'entry_time': datetime.utcnow()
            },
            {
                'symbol': 'WAGMI',
                'address': '0x73c2a42ceB7C7bBa0bFA108015A65f06765dF109',
                'entry_price': 0.000156,
                'current_price': 0.000143,
                'quantity': 1923076,  # ~$300 worth
                'entry_time': datetime.utcnow()
            }
        ]
        
        for pos_data in demo_positions:
            position = Position(
                token_symbol=pos_data['symbol'],
                token_address=pos_data['address'],
                entry_price=pos_data['entry_price'],
                current_price=pos_data['current_price'],
                quantity=pos_data['quantity'],
                entry_time=pos_data['entry_time']
            )
            position.update_price(pos_data['current_price'])
            self.portfolio.add_position(position)
            
        logger.info(f"Initialized portfolio with {len(demo_positions)} demo positions")
        
    def should_buy(self, opportunity_score: float, risk_level: str, current_positions: int) -> bool:
        """Determine if we should buy based on score and risk"""
        if current_positions >= self.max_positions:
            return False
            
        if risk_level in ['extreme']:
            return False
            
        if opportunity_score >= 85:
            return True
        elif opportunity_score >= 75 and risk_level == 'low':
            return True
            
        return False
        
    def should_sell(self, position: Position, current_price: float) -> tuple[bool, str]:
        """Determine if we should sell a position"""
        position.update_price(current_price)
        
        # Stop loss at -20%
        if position.pnl_percent <= -20:
            return True, "Stop loss triggered (-20%)"
            
        # Take profit at +50%
        if position.pnl_percent >= 50:
            return True, "Take profit target reached (+50%)"
            
        # Time-based exit (24 hours for high volatility)
        hours_held = (datetime.utcnow() - position.entry_time).total_seconds() / 3600
        if hours_held > 24 and position.pnl_percent < 10:
            return True, "24hr time exit with low gains"
            
        return False, ""
        
    def calculate_position_size(self, token_price: float) -> float:
        """Calculate position size based on portfolio balance"""
        available_balance = self.portfolio.current_balance
        position_value = available_balance * (self.position_size_percent / 100)
        return position_value / token_price if token_price > 0 else 0
        
    def get_portfolio_summary(self) -> Dict:
        """Get portfolio summary for display"""
        return {
            'total_value': self.portfolio.get_total_value(),
            'starting_balance': self.portfolio.starting_balance,
            'current_balance': self.portfolio.current_balance,
            'total_pnl': self.portfolio.get_total_pnl(),
            'total_pnl_percent': self.portfolio.get_roi(),
            'realized_pnl': self.portfolio.total_realized_pnl,
            'unrealized_pnl': self.portfolio.total_unrealized_pnl,
            'positions_count': len(self.portfolio.positions),
            'win_rate': self.portfolio.get_win_rate(),
            'wins': self.portfolio.win_count,
            'losses': self.portfolio.loss_count
        }
        
    def format_portfolio_display(self) -> str:
        """Format portfolio for console display"""
        summary = self.get_portfolio_summary()
        
        lines = []
        lines.append("\n💰 PORTFOLIO STATUS")
        lines.append("=" * 50)
        lines.append(f"Total Value: ${summary['total_value']:.2f}")
        lines.append(f"Total P&L: ${summary['total_pnl']:.2f} ({summary['total_pnl_percent']:+.2f}%)")
        lines.append(f"Cash Balance: ${summary['current_balance']:.2f}")
        lines.append(f"Win Rate: {summary['win_rate']:.1f}% ({summary['wins']}W/{summary['losses']}L)")
        lines.append("")
        
        if self.portfolio.positions:
            lines.append("📊 OPEN POSITIONS")
            lines.append("-" * 50)
            for position in self.portfolio.positions.values():
                pnl_emoji = "🟢" if position.pnl_percent >= 0 else "🔴"
                lines.append(f"{pnl_emoji} {position.token_symbol}")
                lines.append(f"   Entry: ${position.entry_price:.8f} → Current: ${position.current_price:.8f}")
                lines.append(f"   Value: ${position.position_value_usd:.2f} | P&L: ${position.pnl_usd:.2f} ({position.pnl_percent:+.1f}%)")
                lines.append("")
                
        return '\n'.join(lines)
        
    async def save_portfolio_state(self, filename: str = "portfolio_state.json"):
        """Save portfolio state to file"""
        state = {
            'timestamp': datetime.utcnow().isoformat(),
            'portfolio': {
                'starting_balance': self.portfolio.starting_balance,
                'current_balance': self.portfolio.current_balance,
                'total_realized_pnl': self.portfolio.total_realized_pnl,
                'total_unrealized_pnl': self.portfolio.total_unrealized_pnl,
                'win_count': self.portfolio.win_count,
                'loss_count': self.portfolio.loss_count
            },
            'positions': [
                {
                    'token_symbol': p.token_symbol,
                    'token_address': p.token_address,
                    'entry_price': p.entry_price,
                    'current_price': p.current_price,
                    'quantity': p.quantity,
                    'entry_time': p.entry_time.isoformat(),
                    'pnl_usd': p.pnl_usd,
                    'pnl_percent': p.pnl_percent
                }
                for p in self.portfolio.positions.values()
            ],
            'recent_trades': [
                {
                    'timestamp': t.timestamp.isoformat(),
                    'action': t.action,
                    'token_symbol': t.token_symbol,
                    'price': t.price,
                    'quantity': t.quantity,
                    'value_usd': t.value_usd,
                    'reason': t.reason
                }
                for t in self.portfolio.trade_history[-20:]  # Last 20 trades
            ]
        }
        
        async with aiofiles.open(filename, 'w') as f:
            await f.write(json.dumps(state, indent=2))