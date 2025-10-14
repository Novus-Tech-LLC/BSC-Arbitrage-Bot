// WebSocket connection
let ws = null;
let isConnected = false;

// Store analysis data
let pumpAnalysesMap = new Map();
let narrativeAnalysesMap = new Map();
let claudeAnalysesMap = new Map();

// DOM Elements
const elements = {
    botStatus: document.getElementById('bot-status'),
    botMode: document.getElementById('bot-mode'),
    balance: document.getElementById('balance'),
    totalPnl: document.getElementById('total-pnl'),
    winRate: document.getElementById('win-rate'),
    tradesCount: document.getElementById('trades-count'),
    trendingTbody: document.getElementById('trending-tbody'),
    positionsTbody: document.getElementById('positions-tbody'),
    tradesTbody: document.getElementById('trades-tbody'),
    activityFeed: document.getElementById('activity-feed'),
    startBtn: document.getElementById('start-btn'),
    stopBtn: document.getElementById('stop-btn'),
    timestamp: document.getElementById('timestamp'),
    nextResearch: document.getElementById('next-research'),
    researchReports: document.getElementById('research-reports'),
    analysisCards: document.getElementById('analysis-cards'),
    aiThinkingLog: document.getElementById('ai-thinking-log')
};

// Connect to WebSocket
function connectWebSocket() {
    ws = new WebSocket('ws://localhost:3001');
    
    ws.onopen = () => {
        isConnected = true;
        addActivity('[SYSTEM] Connected to trading bot server');
    };
    
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleMessage(message);
    };
    
    ws.onclose = () => {
        isConnected = false;
        addActivity('[SYSTEM] Disconnected from server');
        setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = (error) => {
        addActivity('[ERROR] WebSocket connection error');
    };
}

// Add AI thinking log entry
function addThinkingLog(agent, message) {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });
    
    const item = document.createElement('div');
    item.className = 'thinking-item';
    item.innerHTML = `
        <span class="thinking-time">${time}</span>
        <span class="thinking-agent" data-agent="${agent}">[${agent}]</span>
        <span class="thinking-message">${message}</span>
    `;
    
    elements.aiThinkingLog.appendChild(item);
    elements.aiThinkingLog.scrollTop = elements.aiThinkingLog.scrollHeight;
    
    // Keep only last 100 entries
    while (elements.aiThinkingLog.children.length > 100) {
        elements.aiThinkingLog.removeChild(elements.aiThinkingLog.firstChild);
    }
}

// Handle incoming WebSocket messages
function handleMessage(message) {
    switch (message.type) {
        case 'status':
            updateBotStatus(message.data);
            break;
        case 'stats':
            updateStats(message.data);
            break;
        case 'trending':
        case 'trending-update':
            updateTrendingTokens(message.data);
            updateTimestamp();
            break;
        case 'positions':
            updatePositions(message.data);
            break;
        case 'trades':
            updateTrades(message.data);
            break;
        case 'activity':
            addActivity(`[${message.data.type.toUpperCase()}] ${message.data.message}`);
            break;
        case 'trade':
            const trade = message.data;
            addActivity(`[TRADE] ${trade.type.toUpperCase()} ${trade.tokenSymbol} @ $${trade.price.toFixed(6)}`);
            break;
        case 'pumpAnalyses':
            handlePumpAnalyses(message.data);
            break;
        case 'narratives':
            handleNarratives(message.data);
            break;
        case 'claudeAnalysis':
            handleClaudeAnalysis(message.data);
            break;
        case 'ai-thinking':
            addThinkingLog(message.data.agent, message.data.message);
            break;
        case 'research':
            updateResearch(message.data);
            break;
    }
}

// Update bot status
function updateBotStatus(status) {
    elements.botStatus.textContent = status.running ? 'ONLINE' : 'OFFLINE';
    elements.botStatus.className = status.running ? 'value profit blink' : 'value loss';
    elements.botMode.textContent = status.mode.toUpperCase();
    
    elements.startBtn.disabled = status.running;
    elements.stopBtn.disabled = !status.running;
}

// Update treasury stats
function updateStats(stats) {
    elements.balance.textContent = `$${formatNumber(stats.balance)}`;
    elements.totalPnl.textContent = formatPnL(stats.totalPnl);
    elements.totalPnl.className = `stat-value ${stats.totalPnl >= 0 ? 'profit' : 'loss'}`;
    elements.winRate.textContent = `${stats.winRate.toFixed(1)}%`;
    elements.tradesCount.textContent = stats.tradesCount;
}

// Handle pump analyses
function handlePumpAnalyses(analyses) {
    analyses.forEach(analysis => {
        pumpAnalysesMap.set(analysis.token.address, analysis);
    });
    // Refresh trending table if we have data
    const trendingRows = elements.trendingTbody.querySelectorAll('tr');
    if (trendingRows.length > 0 && !trendingRows[0].classList.contains('no-data')) {
        updateTrendingTokens(lastTrendingTokens);
    }
    displayAnalysisCards();
}

// Handle narrative analyses  
function handleNarratives(analyses) {
    analyses.forEach(analysis => {
        narrativeAnalysesMap.set(analysis.token?.address || analysis.symbol, analysis);
    });
    displayAnalysisCards();
}

// Handle Claude AI analysis
function handleClaudeAnalysis(data) {
    const { token, analysis } = data;
    claudeAnalysesMap.set(token.address, analysis);
    
    // Refresh trending table
    if (lastTrendingTokens.length > 0) {
        updateTrendingTokens(lastTrendingTokens);
    }
    
    // Add high confidence alerts to activity feed
    if (analysis.should_invest && analysis.confidence >= 80) {
        addActivity(`[CLAUDE AI] ${token.symbol} - ${analysis.confidence}% confidence | ${analysis.reasoning.substring(0, 100)}...`);
    }
}

// Store last trending tokens for refresh
let lastTrendingTokens = [];

// Update trending tokens
function updateTrendingTokens(tokens) {
    lastTrendingTokens = tokens;
    
    if (tokens.length === 0) {
        elements.trendingTbody.innerHTML = '<tr><td colspan="5" class="no-data">No trending tokens found</td></tr>';
        return;
    }
    
    elements.trendingTbody.innerHTML = tokens.map(token => {
        const pumpAnalysis = pumpAnalysesMap.get(token.address);
        const narrativeAnalysis = narrativeAnalysesMap.get(token.address);
        const claudeAnalysis = claudeAnalysesMap.get(token.address);
        
        // Get pump phase emoji and color
        const phaseInfo = getPumpPhaseInfo(pumpAnalysis?.phase);
        const riskColor = getRiskColor(pumpAnalysis?.riskLevel);
        
        return `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    ${token.logo ? `<img src="${token.logo}" alt="${token.symbol}" style="width: 24px; height: 24px; border-radius: 50%;">` : ''}
                    <div>
                        <div style="font-weight: bold;">${token.symbol}</div>
                        <div style="font-size: 11px; color: #888;">${token.name}</div>
                        ${pumpAnalysis ? `<div style="font-size: 10px; color: ${phaseInfo.color}">${phaseInfo.emoji} ${pumpAnalysis.phase.toUpperCase()}</div>` : ''}
                        ${narrativeAnalysis ? `<div style="font-size: 10px; color: #00ff88;">📖 ${narrativeAnalysis.narrativeType} (${narrativeAnalysis.score}/100)</div>` : ''}
                        ${claudeAnalysis ? `<div style="font-size: 10px; color: ${claudeAnalysis.should_invest ? '#00ffff' : '#ff4444'}">🤖 Claude: ${claudeAnalysis.confidence}% ${claudeAnalysis.should_invest ? '✅' : '❌'}</div>` : ''}
                    </div>
                </div>
            </td>
            <td>$${parseFloat(token.priceUsd).toFixed(6)}</td>
            <td class="${token.priceChange24h >= 0 ? 'profit' : 'loss'}">${token.priceChange24h.toFixed(2)}%</td>
            <td>
                $${formatNumber(token.volume24h)}
                ${pumpAnalysis && pumpAnalysis.volumeAnalysis.volumeMCRatio > 1.5 ? 
                    `<div style="font-size: 10px; color: #ff4444;">⚠️ Vol/MC: ${pumpAnalysis.volumeAnalysis.volumeMCRatio.toFixed(1)}x</div>` : ''}
            </td>
            <td>
                ${pumpAnalysis && pumpAnalysis.entryAnalysis.shouldEnter ? 
                    `<span style="color: #00ff00; margin-right: 10px;">✅ ENTRY</span>` : 
                    pumpAnalysis ? `<span style="color: ${riskColor}; margin-right: 10px;">❌ NO ENTRY</span>` : ''}
                ${token.website ? `<a href="${token.website}" target="_blank" style="color: #00ffff; margin-right: 10px;">Web</a>` : ''}
                ${token.dexScreenerUrl ? `<a href="${token.dexScreenerUrl}" target="_blank" style="color: #00ff00;">Chart</a>` : ''}
            </td>
        </tr>
        `;
    }).join('');
}

// Get pump phase visual info
function getPumpPhaseInfo(phase) {
    const phaseMap = {
        'accumulation': { emoji: '🏗️', color: '#4444ff' },
        'initial_pump': { emoji: '🚀', color: '#00ff00' },
        'peak_fomo': { emoji: '🔥', color: '#ff8800' },
        'distribution': { emoji: '💀', color: '#ff0000' },
        'dump': { emoji: '📉', color: '#880000' },
        'dead': { emoji: '⚰️', color: '#444444' }
    };
    return phaseMap[phase] || { emoji: '❓', color: '#888888' };
}

// Get risk level color
function getRiskColor(riskLevel) {
    const riskMap = {
        'LOW': '#00ff00',
        'MEDIUM': '#ffff00',
        'HIGH': '#ff8800',
        'VERY HIGH': '#ff4444',
        'EXTREME': '#ff0000'
    };
    return riskMap[riskLevel] || '#888888';
}

// Update positions
function updatePositions(positions) {
    const openPositions = positions.filter(p => p.status === 'open');
    
    if (openPositions.length === 0) {
        elements.positionsTbody.innerHTML = '<tr><td colspan="5" class="no-data">No open positions</td></tr>';
        return;
    }
    
    elements.positionsTbody.innerHTML = openPositions.map(position => {
        const holdTime = getHoldTime(position.entryTime);
        const strategyBadge = getStrategyBadge(position.strategy);
        
        return `
        <tr>
            <td>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${position.token.logo ? `<img src="${position.token.logo}" alt="${position.token.symbol}" style="width: 20px; height: 20px; border-radius: 50%;">` : ''}
                        <span>${position.token.symbol}</span>
                        ${strategyBadge}
                    </div>
                    <span style="font-size: 11px; color: #888;">Held: ${holdTime}</span>
                </div>
            </td>
            <td>$${position.entryPrice.toFixed(6)}</td>
            <td>$${position.currentPrice.toFixed(6)}</td>
            <td class="${position.pnl >= 0 ? 'profit' : 'loss'}">${formatPnL(position.pnl)}</td>
            <td class="${position.pnlPercent >= 0 ? 'profit' : 'loss'}">${position.pnlPercent.toFixed(2)}%</td>
        </tr>`
    }).join('');
}

// Update trades
function updateTrades(trades) {
    if (trades.length === 0) {
        elements.tradesTbody.innerHTML = '<tr><td colspan="6" class="no-data">No trades yet</td></tr>';
        return;
    }
    
    elements.tradesTbody.innerHTML = trades.reverse().map(trade => `
        <tr>
            <td>${formatTime(trade.timestamp)}</td>
            <td class="${trade.type === 'buy' ? 'profit' : 'loss'}">${trade.type.toUpperCase()}</td>
            <td>${trade.tokenSymbol}</td>
            <td>$${trade.price.toFixed(6)}</td>
            <td>$${formatNumber(trade.usdValue)}</td>
            <td class="${(trade.pnl || 0) >= 0 ? 'profit' : 'loss'}">${trade.pnl ? formatPnL(trade.pnl) : '-'}</td>
        </tr>
    `).join('');
}

// Add activity to feed
function addActivity(message) {
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.textContent = `[${formatTime(new Date())}] ${message}`;
    elements.activityFeed.insertBefore(item, elements.activityFeed.firstChild);
    
    // Keep only last 50 items
    while (elements.activityFeed.children.length > 50) {
        elements.activityFeed.removeChild(elements.activityFeed.lastChild);
    }
}

// Format helpers
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
}

function formatPnL(pnl) {
    const sign = pnl >= 0 ? '+' : '';
    return `${sign}$${Math.abs(pnl).toFixed(2)}`;
}

function formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { hour12: false });
}

// Update timestamp
function updateTimestamp() {
    const now = new Date();
    elements.timestamp.textContent = now.toLocaleTimeString('en-US', { hour12: false });
}

// Button handlers
elements.startBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('http://localhost:3000/api/bot/start', { method: 'POST' });
        const data = await response.json();
        addActivity('[SYSTEM] Starting bot...');
    } catch (error) {
        addActivity('[ERROR] Failed to start bot');
    }
});

elements.stopBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('http://localhost:3000/api/bot/stop', { method: 'POST' });
        const data = await response.json();
        addActivity('[SYSTEM] Stopping bot...');
    } catch (error) {
        addActivity('[ERROR] Failed to stop bot');
    }
});

// Update research reports
function updateResearch(reports) {
    if (!reports || reports.length === 0) {
        elements.researchReports.innerHTML = '<div class="no-data">Research reports will appear here...</div>';
        return;
    }
    
    elements.researchReports.innerHTML = reports.map(report => `
        <div class="research-report ${report.isNew ? 'new' : ''}">
            <div class="report-header">
                <div class="report-token">${report.coin.symbol}</div>
                <div class="report-metrics">
                    <div class="metric">
                        <span class="metric-label">VOLUME SURGE</span>
                        <span class="metric-value" style="color: #ffff00">${report.volumeMultiple.toFixed(1)}x</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">PRICE 24H</span>
                        <span class="metric-value ${report.coin.priceChange24h >= 0 ? 'profit' : 'loss'}">
                            ${report.coin.priceChange24h > 0 ? '+' : ''}${report.coin.priceChange24h.toFixed(1)}%
                        </span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">MARKET CAP</span>
                        <span class="metric-value">$${formatNumber(report.coin.marketCap)}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">VOLUME/MC</span>
                        <span class="metric-value" style="${report.coin.volume24h/report.coin.marketCap > 2 ? 'color: #ff0000' : ''}">
                            ${(report.coin.volume24h/report.coin.marketCap).toFixed(2)}
                        </span>
                    </div>
                </div>
                <div class="report-timestamp">${formatTime(report.timestamp)}</div>
            </div>
            
            <div class="report-section">
                <h4>Narrative Analysis</h4>
                <div class="narrative-text">${report.narrative}</div>
            </div>
            
            <div class="report-section">
                <h4>Entry Zones</h4>
                <div class="entry-zones">
                    ${report.entryZones.map(zone => `
                        <div class="entry-zone">
                            <span class="zone-price">$${zone.price.toFixed(8)}</span>
                            <span class="zone-reason">${zone.reasoning}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div class="report-section">
                    <h4>Risk Factors</h4>
                    <ul class="risks">
                        ${report.risks.map(risk => `<li>${risk}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="report-section">
                    <h4>Catalysts</h4>
                    <ul class="catalysts">
                        ${report.catalysts.map(catalyst => `<li>${catalyst}</li>`).join('')}
                    </ul>
                </div>
            </div>
            
            ${report.similarToHistoricalPumps.length > 0 ? `
                <div class="report-section">
                    <h4>Similar Historical Pumps</h4>
                    <div class="similar-pumps">
                        ${report.similarToHistoricalPumps.map(pump => `<span class="similar-tag">${pump}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${report.claudeAnalysis ? `
                <div class="claude-analysis">
                    <h5>Claude AI Analysis</h5>
                    <div class="claude-decision ${report.claudeAnalysis.should_invest ? 'invest' : 'avoid'}">
                        ${report.claudeAnalysis.should_invest ? 'INVEST' : 'AVOID'} - ${report.claudeAnalysis.confidence}% Confidence
                    </div>
                    <div>${report.claudeAnalysis.reasoning}</div>
                </div>
            ` : ''}
            
            <a href="${report.coin.dexScreenerUrl}" target="_blank" class="dex-link">View on DexScreener</a>
        </div>
    `).join('');
}

// Update research countdown
let nextResearchTime = Date.now() + 60 * 60 * 1000; // 1 hour from now
function updateResearchCountdown() {
    const now = Date.now();
    const timeLeft = Math.max(0, nextResearchTime - now);
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    
    elements.nextResearch.textContent = `Next scan: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    if (timeLeft === 0) {
        nextResearchTime = Date.now() + 60 * 60 * 1000; // Reset to 1 hour
    }
}

// Display analysis cards
function displayAnalysisCards() {
    const analyses = [];
    
    // Combine all analyses
    for (const [address, narrative] of narrativeAnalysesMap) {
        const pumpAnalysis = pumpAnalysesMap.get(address);
        const claudeAnalysis = claudeAnalysesMap.get(address);
        
        if (narrative && pumpAnalysis) {
            analyses.push({
                address,
                token: narrative.token || { symbol: narrative.symbol, priceUsd: '0' },
                narrative,
                pumpAnalysis,
                claudeAnalysis
            });
        }
    }
    
    if (analyses.length === 0) {
        elements.analysisCards.innerHTML = '<div class="no-data">No analysis plays available yet...</div>';
        return;
    }
    
    elements.analysisCards.innerHTML = analyses.map(analysis => `
        <div class="analysis-card" data-address="${analysis.address}" onclick="toggleAnalysisCard(this)">
            <div class="analysis-card-header">
                <div class="analysis-token">
                    <span class="analysis-token-symbol">${analysis.token.symbol}</span>
                    <span class="analysis-token-price">$${parseFloat(analysis.token.priceUsd).toFixed(8)}</span>
                </div>
                <div class="analysis-scores">
                    <div class="score-item">
                        <div class="score-label">Narrative</div>
                        <div class="score-value ${analysis.narrative.score >= 70 ? 'profit' : analysis.narrative.score >= 40 ? '' : 'loss'}">${analysis.narrative.score}/100</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">Pump</div>
                        <div class="score-value ${analysis.pumpAnalysis.pumpScore >= 70 ? 'profit' : analysis.pumpAnalysis.pumpScore >= 40 ? '' : 'loss'}">${analysis.pumpAnalysis.pumpScore}/100</div>
                    </div>
                    ${analysis.claudeAnalysis ? `
                    <div class="score-item">
                        <div class="score-label">Claude AI</div>
                        <div class="score-value ${analysis.claudeAnalysis.confidence >= 70 ? 'profit' : analysis.claudeAnalysis.confidence >= 40 ? '' : 'loss'}">${analysis.claudeAnalysis.confidence}%</div>
                    </div>
                    ` : ''}
                </div>
                <span class="expand-icon">▼</span>
            </div>
            
            <div class="analysis-content">
                <div class="analysis-section">
                    <h4>🎭 Narrative Analysis</h4>
                    <p><strong>Type:</strong> ${analysis.narrative.type}</p>
                    <p><strong>Viral Potential:</strong> ${analysis.narrative.viralPotential}</p>
                    <p><strong>Sentiment:</strong> ${analysis.narrative.sentiment}</p>
                    <p>${analysis.narrative.reasoning}</p>
                </div>
                
                <div class="analysis-section">
                    <h4>📈 Pump Detection</h4>
                    <p><strong>Phase:</strong> ${analysis.pumpAnalysis.phase}</p>
                    <p><strong>Risk Level:</strong> ${analysis.pumpAnalysis.riskLevel}</p>
                    <p><strong>Should Enter:</strong> ${analysis.pumpAnalysis.entryAnalysis?.shouldEnter ? 'YES ✅' : 'NO ❌'}</p>
                    ${analysis.pumpAnalysis.warnings?.length > 0 ? `
                        <p class="analysis-warnings"><strong>Warnings:</strong><br>${analysis.pumpAnalysis.warnings.join('<br>')}</p>
                    ` : ''}
                    ${analysis.pumpAnalysis.insights?.length > 0 ? `
                        <p class="analysis-insights"><strong>Insights:</strong><br>${analysis.pumpAnalysis.insights.join('<br>')}</p>
                    ` : ''}
                </div>
                
                ${analysis.claudeAnalysis ? `
                <div class="analysis-section">
                    <h4>🤖 Claude AI Analysis</h4>
                    <p><strong>Recommendation:</strong> ${analysis.claudeAnalysis.should_invest ? 'INVEST ✅' : 'AVOID ❌'}</p>
                    <p><strong>Confidence:</strong> ${analysis.claudeAnalysis.confidence}%</p>
                    <p><strong>Risk:</strong> ${analysis.claudeAnalysis.risk_level}</p>
                    <p>${analysis.claudeAnalysis.reasoning}</p>
                </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Toggle analysis card expansion
function toggleAnalysisCard(card) {
    // Close other expanded cards
    document.querySelectorAll('.analysis-card.expanded').forEach(c => {
        if (c !== card) c.classList.remove('expanded');
    });
    
    // Toggle current card
    card.classList.toggle('expanded');
    
    // Update icon
    const icon = card.querySelector('.expand-icon');
    icon.textContent = card.classList.contains('expanded') ? '▲' : '▼';
}

// Initialize
connectWebSocket();
setInterval(updateTimestamp, 1000);
setInterval(updateResearchCountdown, 1000);
addActivity('[SYSTEM] Dashboard initialized. Connecting to bot...');

// Helper function to calculate hold time
function getHoldTime(entryTime) {
    const now = new Date();
    const entry = new Date(entryTime);
    const diffMs = now - entry;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 1) {
        const minutes = Math.floor(diffMs / (1000 * 60));
        return `${minutes}m`;
    } else if (diffHours < 24) {
        return `${Math.floor(diffHours)}h`;
    } else {
        const days = Math.floor(diffHours / 24);
        const hours = Math.floor(diffHours % 24);
        return `${days}d ${hours}h`;
    }
}

// Helper function to get strategy badge
function getStrategyBadge(strategy) {
    if (!strategy) return '';
    
    const badges = {
        'scalp': '<span style="background: #ff6b6b; color: #000; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold;">SCALP</span>',
        'swing': '<span style="background: #4ecdc4; color: #000; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold;">SWING</span>',
        'hold': '<span style="background: #45b7d1; color: #000; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold;">HOLD</span>'
    };
    
    return badges[strategy] || '';
}

// Load pre-populated analyses on startup
fetchInitialAnalyses();

// Fetch initial analyses
async function fetchInitialAnalyses() {
    try {
        // Fetch narratives
        const narrativesResponse = await fetch('/api/narratives');
        const narratives = await narrativesResponse.json();
        handleNarratives(narratives);
        
        // Fetch pump analyses
        const pumpResponse = await fetch('/api/pump-analyses');
        const pumpAnalyses = await pumpResponse.json();
        handlePumpAnalyses(pumpAnalyses);
        
        // Fetch Claude analyses
        const claudeResponse = await fetch('/api/claude-analyses');
        const claudeAnalyses = await claudeResponse.json();
        claudeAnalyses.forEach(analysis => {
            claudeAnalysesMap.set(analysis.token?.address || 'unknown', analysis);
        });
        
        displayAnalysisCards();
    } catch (error) {
        console.error('Error fetching initial analyses:', error);
    }
}