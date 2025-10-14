#!/usr/bin/env python3

import asyncio
import argparse
import logging
import os
from datetime import datetime
import signal
import sys

from dexscreener_api import DexScreenerAPI
from price_tracker import LivePriceTracker
from hourly_analyzer import HourlyAnalyzer
from notifier import NotificationSystem, ConsoleNotificationChannel, FileNotificationChannel
from portfolio_tracker import PortfolioManager
from live_dashboard import LiveDashboard

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class CryptoAnalysisBot:
    def __init__(self, config: dict):
        self.config = config
        self.api = None
        self.price_tracker = None
        self.analyzer = None
        self.notifier = None
        self.portfolio_manager = None
        self.dashboard = None
        self.is_running = False
        
    async def initialize(self):
        """Initialize all components"""
        logger.info("Initializing Crypto Analysis Bot...")
        
        # Initialize API
        self.api = DexScreenerAPI()
        
        # Initialize price tracker
        self.price_tracker = LivePriceTracker(self.api)
        
        # Initialize portfolio manager
        self.portfolio_manager = PortfolioManager(starting_balance=1000.0)
        self.portfolio_manager.initialize_demo_positions()
        
        # Initialize analyzer
        self.analyzer = HourlyAnalyzer(self.api, self.price_tracker)
        
        # Initialize notification system
        self.notifier = NotificationSystem()
        
        # Initialize dashboard
        self.dashboard = LiveDashboard(self.api, self.portfolio_manager, self.analyzer, self.price_tracker)
        
        # Add notification channels
        if self.config.get('console_notifications', True):
            self.notifier.add_channel(ConsoleNotificationChannel())
            
        if self.config.get('file_notifications', True):
            os.makedirs(self.config.get('notification_dir', './notifications'), exist_ok=True)
            self.notifier.add_channel(FileNotificationChannel(self.config.get('notification_dir', './notifications')))
            
        # Set notification filters
        if 'notification_filters' in self.config:
            for key, value in self.config['notification_filters'].items():
                self.notifier.set_filter(key, value)
                
        logger.info("Initialization complete!")
        
    async def run_hourly_analysis(self):
        """Run hourly analysis loop"""
        while self.is_running:
            try:
                logger.info("Running hourly analysis...")
                
                # Perform analysis
                async with self.api:
                    report = await self.analyzer.perform_hourly_analysis()
                    
                    # Save report
                    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
                    report_dir = self.config.get('report_dir', './reports')
                    os.makedirs(report_dir, exist_ok=True)
                    
                    report_file = f"{report_dir}/analysis_{timestamp}.json"
                    await self.analyzer.save_report(report, report_file)
                    logger.info(f"Report saved to {report_file}")
                    
                    # Update dashboard with latest report
                    self.dashboard.last_report = report
                    
                    # Process notifications
                    await self.notifier.process_hourly_report(report)
                    
                    # Print summary to console
                    if self.config.get('print_summary', True) and not self.config.get('dashboard_mode', False):
                        print(self.analyzer.format_report_summary(report))
                        
                    # Save portfolio state
                    await self.portfolio_manager.save_portfolio_state()
                        
                # Wait for next hour
                if self.config.get('test_mode', False):
                    await asyncio.sleep(60)  # 1 minute in test mode
                else:
                    await asyncio.sleep(3600)  # 1 hour
                    
            except Exception as e:
                logger.error(f"Error in hourly analysis: {e}")
                await asyncio.sleep(300)  # Wait 5 minutes before retry
                
    async def run_price_tracking(self):
        """Run continuous price tracking"""
        async with self.api:
            # Add initial tokens to track
            if self.config.get('track_trending', True):
                trending = await self.api.get_trending_tokens()
                for token in trending[:20]:  # Track top 20 trending
                    self.price_tracker.add_token(token)
                    
            # Register callback for price updates
            async def price_update_callback(updates):
                alerts = self.price_tracker.get_alerts()
                for alert in alerts:
                    await self.notifier._notify_price_alert(alert)
                    
            self.price_tracker.register_callback(price_update_callback)
            
            # Start tracking
            await self.price_tracker.start_tracking()
            
    async def run_dashboard(self):
        """Run the live dashboard"""
        await self.dashboard.run()
        
    async def start(self):
        """Start the bot"""
        await self.initialize()
        self.is_running = True
        
        logger.info("Starting Crypto Analysis Bot...")
        
        # Create tasks
        tasks = []
        
        # Dashboard mode or regular mode
        if self.config.get('dashboard_mode', False):
            # In dashboard mode, run everything concurrently with dashboard
            tasks.append(asyncio.create_task(self.run_dashboard()))
            tasks.append(asyncio.create_task(self.run_hourly_analysis()))
            if self.config.get('enable_price_tracking', True):
                tasks.append(asyncio.create_task(self.run_price_tracking()))
        else:
            # Regular mode without dashboard
            tasks.append(asyncio.create_task(self.run_hourly_analysis()))
            if self.config.get('enable_price_tracking', True):
                tasks.append(asyncio.create_task(self.run_price_tracking()))
            
        # Wait for all tasks
        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            logger.info("Tasks cancelled")
            
    def stop(self):
        """Stop the bot"""
        logger.info("Stopping Crypto Analysis Bot...")
        self.is_running = False
        if self.price_tracker:
            self.price_tracker.stop_tracking()

def load_config(config_file: str = None) -> dict:
    """Load configuration"""
    default_config = {
        'console_notifications': True,
        'file_notifications': True,
        'notification_dir': './notifications',
        'report_dir': './reports',
        'print_summary': True,
        'enable_price_tracking': True,
        'track_trending': True,
        'test_mode': False,
        'dashboard_mode': False,
        'notification_filters': {
            'min_opportunity_score': 70,
            'max_risk_level': 'high',
            'min_price_change': 20,
            'min_volume_spike': 2.0
        }
    }
    
    if config_file and os.path.exists(config_file):
        import json
        with open(config_file, 'r') as f:
            user_config = json.load(f)
            default_config.update(user_config)
            
    return default_config

def main():
    parser = argparse.ArgumentParser(description='Crypto Analysis Bot - Find tokens similar to DUST and PRICELESS')
    parser.add_argument('--config', type=str, help='Configuration file path')
    parser.add_argument('--test-mode', action='store_true', help='Run in test mode (shorter intervals)')
    parser.add_argument('--no-price-tracking', action='store_true', help='Disable continuous price tracking')
    parser.add_argument('--console-only', action='store_true', help='Only output to console')
    parser.add_argument('--dashboard', action='store_true', help='Run with live dashboard for streaming')
    
    args = parser.parse_args()
    
    # Load configuration
    config = load_config(args.config)
    
    # Apply command line arguments
    if args.test_mode:
        config['test_mode'] = True
    if args.no_price_tracking:
        config['enable_price_tracking'] = False
    if args.console_only:
        config['file_notifications'] = False
    if args.dashboard:
        config['dashboard_mode'] = True
        config['console_notifications'] = False  # Disable console notifications in dashboard mode
        
    # Create bot
    bot = CryptoAnalysisBot(config)
    
    # Handle signals
    def signal_handler(sig, frame):
        logger.info("Received interrupt signal")
        bot.stop()
        sys.exit(0)
        
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Run bot
    try:
        asyncio.run(bot.start())
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Bot error: {e}")
        raise

if __name__ == "__main__":
    main()