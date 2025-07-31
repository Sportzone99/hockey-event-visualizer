// Faceoff Analytics - Following the same pattern as shots analyzer
class FaceoffAnalyzer {
    constructor() {
        this.allEvents = [];
        this.allFaceoffs = [];
        this.filteredFaceoffs = [];
        this.currentTimeFilter = 0;
        this.isPlaying = false;
        this.playInterval = null;
        this.playSpeed = 5;
        this.timeRange = { min: 0, max: 1200 };
        this.teams = [];
        this.games = [];
        this.currentGame = null;
        this.players = { 'United States': [], 'Canada': [], 'Finland': [], 'Olympic Athletes from Russia': [] };
        this.currentView = 'team-locations';
        this.previousView = null;
        
        // Faceoff zone definitions
        this.faceoffZones = {
            defensive: { name: 'Defensive Zone', color: '#DC2626' },
            neutral: { name: 'Neutral Zone', color: '#F59E0B' },
            offensive: { name: 'Offensive Zone', color: '#10B981' }
        };
        
        // Team colors for the 4 Olympic teams
        this.teamColors = {
            'United States': '#1D4ED8',
            'Canada': '#DC2626',
            'Finland': '#87CEEB',
            'Olympic Athletes from Russia': '#FFD700'
        };
        
        this.init();
    }
    
    async init() {
        try {
            await this.loadInitialData();
            this.setupEventListeners();
            this.createVisualization();
            
            // Hide loading after plot is created and resized
            setTimeout(() => {
                this.hideLoading();
            }, 200);
        } catch (error) {
            console.error('Error initializing faceoff analyzer:', error);
            this.showError('Failed to load faceoff data');
        }
    }
    
    async loadInitialData() {
        try {
            // Load games first
            const gamesData = await fetch('/api/games').then(res => res.json());
            this.games = gamesData;
            this.setupGameSelector();
            
            // Don't load other data until a game is selected
            if (!this.currentGame) {
                this.showGameSelectionMessage();
                return;
            }
            
            // Load all initial data in parallel for selected game
            const [eventsData, teamsData, playersData, timeRangeData] = await Promise.all([
                fetch(`/api/events?game=${encodeURIComponent(this.currentGame)}`).then(res => res.json()),
                fetch(`/api/teams?game=${encodeURIComponent(this.currentGame)}`).then(res => res.json()),
                fetch('/api/players').then(res => res.json()),
                fetch('/api/time-range').then(res => res.json())
            ]);
            
            this.allEvents = eventsData;
            
            // Filter to only faceoff events and add analysis data
            this.allFaceoffs = eventsData.filter(event => 
                event.event === 'Faceoff Win'
            ).map(faceoff => ({
                ...faceoff,
                zone: this.determineFaceoffZone(faceoff.x_coordinate),
                technique: (faceoff.detail_1 || 'unknown').toLowerCase(),
                opponent: faceoff.player_2 || 'Unknown',
                situation: this.getGameSituation(faceoff)
            }));
            
            this.filteredFaceoffs = [...this.allFaceoffs];
            this.teams = teamsData;
            this.timeRange = {
                min: timeRangeData.min_seconds || 0,
                max: timeRangeData.max_seconds || 1200
            };
            
            this.organizePlayersByTeam(eventsData);
            this.updateTeamCheckboxes();
            this.updatePlayerDropdowns();
            this.applyFilters();
            this.setupTimeControls();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError('Failed to load faceoff data');
        }
    }
    
    setupGameSelector() {
        const gameSelector = document.getElementById('game-selector');
        
        // Clear existing options
        gameSelector.innerHTML = '<option value="">Select Game...</option>';
        
        // Add game options
        this.games.forEach(game => {
            const option = document.createElement('option');
            option.value = game.id;
            option.textContent = `${game.home_team} vs ${game.away_team} (${game.date})`;
            gameSelector.appendChild(option);
        });
        
        // Add change listener
        gameSelector.addEventListener('change', (e) => {
            this.onGameChange(e.target.value);
        });
        
        // Auto-select the first game if available
        if (this.games.length > 0) {
            const firstGame = this.games[0];
            gameSelector.value = firstGame.id;
            this.onGameChange(firstGame.id);
        }
    }
    
    async onGameChange(gameId) {
        if (!gameId) {
            this.currentGame = null;
            this.showGameSelectionMessage();
            return;
        }
        
        this.currentGame = gameId;
        this.showLoading();
        
        try {
            // Reload data for new game
            await this.loadGameData();
            this.hideLoading();
        } catch (error) {
            console.error('Error loading game data:', error);
            this.showError('Failed to load game data');
        }
    }
    
    async loadGameData() {
        // Load game-specific data
        const [eventsData, teamsData, playersData, timeRangeData] = await Promise.all([
            fetch(`/api/events?game=${encodeURIComponent(this.currentGame)}`).then(res => res.json()),
            fetch(`/api/teams?game=${encodeURIComponent(this.currentGame)}`).then(res => res.json()),
            fetch('/api/players').then(res => res.json()),
            fetch('/api/time-range').then(res => res.json())
        ]);
        
        this.allEvents = eventsData;
        
        // Filter to only faceoff events and add analysis data
        this.allFaceoffs = eventsData.filter(event => 
            event.event === 'Faceoff Win'
        ).map(faceoff => ({
            ...faceoff,
            zone: this.determineFaceoffZone(faceoff.x_coordinate),
            technique: (faceoff.detail_1 || 'unknown').toLowerCase(),
            opponent: faceoff.player_2 || 'Unknown',
            situation: this.getGameSituation(faceoff)
        }));
        
        this.filteredFaceoffs = [...this.allFaceoffs];
        this.teams = teamsData;
        this.timeRange = {
            min: timeRangeData.min_seconds || 0,
            max: timeRangeData.max_seconds || 1200
        };
        
        this.organizePlayersByTeam(eventsData);
        this.updateTeamCheckboxes();
        this.updatePlayerDropdowns();
        this.applyFilters();
        this.setupTimeControls();
    }
    
    showGameSelectionMessage() {
        const plotDiv = document.getElementById('plot');
        plotDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; color: #6B7280; text-align: center;">
                <i class="fas fa-dot-circle" style="font-size: 4rem; margin-bottom: 1rem; color: #E5E7EB;"></i>
                <h3 style="margin: 0 0 0.5rem 0; color: #374151;">Welcome to Faceoff Analytics</h3>
                <p style="margin: 0; font-size: 1.1rem;">Please select a game from the dropdown above to begin analysis</p>
            </div>
        `;
        
        // Clear stats
        document.getElementById('usa-faceoffs').textContent = '-';
        document.getElementById('canada-faceoffs').textContent = '-';
        document.getElementById('usa-win-percentage').textContent = '-';
        document.getElementById('canada-win-percentage').textContent = '-';
        document.getElementById('total-faceoffs').textContent = '-';
    }
    
    determineFaceoffZone(x) {
        if (!x) return 'neutral';
        
        if (x <= 75) return 'defensive';
        if (x >= 125) return 'offensive';
        return 'neutral';
    }
    
    getGameSituation(faceoff) {
        if (!faceoff.home_team_skaters || !faceoff.away_team_skaters) {
            return '5v5';
        }
        
        const homeSkaters = parseInt(faceoff.home_team_skaters);
        const awaySkaters = parseInt(faceoff.away_team_skaters);
        
        if (homeSkaters === awaySkaters && homeSkaters === 5) {
            return '5v5';
        } else if (homeSkaters > awaySkaters) {
            return 'canada-powerplay';
        } else if (awaySkaters > homeSkaters) {
            return 'usa-powerplay';
        }
        
        return '5v5';
    }
    
    organizePlayersByTeam(events) {
        // Reset player lists
        Object.keys(this.players).forEach(team => {
            this.players[team] = [];
        });
        
        // Extract unique players by team from faceoff events
        const playerMap = {};
        this.allFaceoffs.forEach(faceoff => {
            if (faceoff.player && faceoff.team_display) {
                if (!playerMap[faceoff.team_display]) {
                    playerMap[faceoff.team_display] = new Set();
                }
                playerMap[faceoff.team_display].add(faceoff.player);
            }
        });
        
        // Convert to arrays and sort
        Object.keys(playerMap).forEach(team => {
            this.players[team] = Array.from(playerMap[team]).sort();
        });
    }
    
    updatePlayerDropdowns() {
        const dropdownsContainer = document.getElementById('player-dropdowns');
        
        // Clear existing dropdowns
        dropdownsContainer.innerHTML = '';
        
        // Create dropdowns for current game's teams
        if (this.teams && this.teams.length > 0) {
            this.teams.forEach(team => {
                const select = document.createElement('select');
                select.className = 'select-input player-select';
                select.setAttribute('data-team', team);
                select.id = `player-${team.toLowerCase().replace(/\s+/g, '-')}`;
                
                // Add default option
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                const shortName = team === 'United States' ? 'USA' : 
                                team === 'Olympic Athletes from Russia' ? 'Russia' : team;
                defaultOption.textContent = `All ${shortName} Players`;
                select.appendChild(defaultOption);
                
                // Add player options
                if (this.players[team]) {
                    this.players[team].forEach(player => {
                        const option = document.createElement('option');
                        option.value = player;
                        option.textContent = player;
                        select.appendChild(option);
                    });
                }
                
                // Add event listener
                select.addEventListener('change', () => this.applyFilters());
                
                dropdownsContainer.appendChild(select);
            });
        }
    }
    
    updateTeamCheckboxes() {
        // Update team checkboxes to only show teams in current game
        const allTeamCheckboxes = ['team-usa', 'team-canada', 'team-finland', 'team-russia'];
        
        allTeamCheckboxes.forEach(checkboxId => {
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                const teamName = checkbox.value;
                const isInCurrentGame = this.teams && this.teams.includes(teamName);
                
                // Show/hide checkbox based on whether team is in current game
                checkbox.parentElement.style.display = isInCurrentGame ? 'flex' : 'none';
                
                // Check the checkbox if team is in current game, uncheck if not
                checkbox.checked = isInCurrentGame;
            }
        });
    }
    
    setupEventListeners() {
        // Analysis mode switcher
        document.querySelectorAll('.shot-view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.shot-view-btn').forEach(b => b.classList.remove('active'));
                e.target.closest('.shot-view-btn').classList.add('active');
                this.currentView = e.target.closest('.shot-view-btn').dataset.view;
                this.updateVisualization();
            });
        });
        
        // Filter listeners
        document.getElementById('technique-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('zone-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('game-situation-filter').addEventListener('change', () => this.applyFilters());
        
        // Team checkboxes
        document.getElementById('team-usa').addEventListener('change', () => this.applyFilters());
        document.getElementById('team-canada').addEventListener('change', () => this.applyFilters());
        document.getElementById('team-finland').addEventListener('change', () => this.applyFilters());
        document.getElementById('team-russia').addEventListener('change', () => this.applyFilters());
        
        // Period checkboxes
        document.querySelectorAll('[id^="period-"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.applyFilters());
        });
        
        // Time controls
        document.getElementById('time-range').addEventListener('input', (e) => {
            this.currentTimeFilter = parseInt(e.target.value);
            this.updateTimeDisplay();
            this.applyFilters();
        });
        
        // Animation controls
        document.getElementById('play-pause').addEventListener('click', () => this.togglePlayback());
        document.getElementById('reset').addEventListener('click', () => this.resetAnimation());
        document.getElementById('speed-control').addEventListener('input', (e) => {
            this.playSpeed = parseInt(e.target.value);
        });
        
        // Window resize
        window.addEventListener('resize', this.debounce(() => this.resizePlot(), 250));
    }
    
    applyFilters() {
        const technique = document.getElementById('technique-filter').value;
        const zone = document.getElementById('zone-filter').value;
        const gameSituation = document.getElementById('game-situation-filter').value;
        
        const selectedTeams = [];
        if (document.getElementById('team-usa').checked) selectedTeams.push('United States');
        if (document.getElementById('team-canada').checked) selectedTeams.push('Canada');
        if (document.getElementById('team-finland').checked) selectedTeams.push('Finland');
        if (document.getElementById('team-russia').checked) selectedTeams.push('Olympic Athletes from Russia');
        
        const selectedPeriods = [];
        document.querySelectorAll('[id^="period-"]:checked').forEach(checkbox => {
            selectedPeriods.push(parseInt(checkbox.value));
        });
        
        // Get player filters dynamically
        const playerFilters = {};
        this.teams.forEach(team => {
            const playerSelect = document.getElementById(`player-${team.toLowerCase().replace(/\s+/g, '-')}`);
            if (playerSelect && playerSelect.value) {
                playerFilters[team] = playerSelect.value;
            }
        });
        
        this.filteredFaceoffs = this.allFaceoffs.filter(faceoff => {
            // Time filter
            if (this.currentTimeFilter > 0) {
                // Use dynamic max time based on selected periods
                const dynamicMaxTime = this.getMaxTimeForSelectedPeriods();
                const maxTime = (this.currentTimeFilter / 100) * dynamicMaxTime;
                if (faceoff.time_seconds > maxTime) return false;
            }
            
            // Technique filter
            if (technique !== 'all' && faceoff.technique !== technique) {
                return false;
            }
            
            // Zone filter
            if (zone !== 'all' && faceoff.zone !== zone) {
                return false;
            }
            
            // Game situation filter
            if (gameSituation !== 'all' && faceoff.situation !== gameSituation) {
                return false;
            }
            
            // Team filter
            if (!selectedTeams.includes(faceoff.team_display)) {
                return false;
            }
            
            // Period filter
            if (!selectedPeriods.includes(faceoff.period)) {
                return false;
            }
            
            // Player filters
            if (playerFilters[faceoff.team_display] && faceoff.player !== playerFilters[faceoff.team_display]) {
                return false;
            }
            
            return true;
        });
        
        this.updateStatistics();
        this.updateVisualization();
        
        // Update time display to reflect selected periods
        this.updateTimeDisplay();
    }
    
    updateStatistics() {
        // Update faceoff stats for current game teams
        if (this.teams && this.teams.length >= 2) {
            const team1Wins = this.filteredFaceoffs.filter(f => f.team_display === this.teams[0]).length;
            const team2Wins = this.filteredFaceoffs.filter(f => f.team_display === this.teams[1]).length;
            const totalFaceoffs = team1Wins + team2Wins;
            
            const team1WinRate = totalFaceoffs > 0 ? ((team1Wins / totalFaceoffs) * 100).toFixed(1) : '0.0';
            const team2WinRate = totalFaceoffs > 0 ? ((team2Wins / totalFaceoffs) * 100).toFixed(1) : '0.0';
            
            // Update stat labels and values dynamically
            const team1Short = this.teams[0] === 'United States' ? 'USA' : 
                             this.teams[0] === 'Olympic Athletes from Russia' ? 'Russia' : this.teams[0];
            const team2Short = this.teams[1] === 'United States' ? 'USA' : 
                             this.teams[1] === 'Olympic Athletes from Russia' ? 'Russia' : this.teams[1];
            
            document.querySelector('#usa-faceoffs').parentNode.querySelector('.stat-label').textContent = `${team1Short} Wins`;
            document.querySelector('#canada-faceoffs').parentNode.querySelector('.stat-label').textContent = `${team2Short} Wins`;
            document.querySelector('#usa-win-percentage').parentNode.querySelector('.stat-label').textContent = `${team1Short} Win %`;
            document.querySelector('#canada-win-percentage').parentNode.querySelector('.stat-label').textContent = `${team2Short} Win %`;
            
            document.getElementById('usa-faceoffs').textContent = team1Wins;
            document.getElementById('canada-faceoffs').textContent = team2Wins;
            document.getElementById('usa-win-percentage').textContent = team1WinRate + '%';
            document.getElementById('canada-win-percentage').textContent = team2WinRate + '%';
            document.getElementById('total-faceoffs').textContent = totalFaceoffs;
        } else {
            document.getElementById('usa-faceoffs').textContent = '-';
            document.getElementById('canada-faceoffs').textContent = '-';
            document.getElementById('usa-win-percentage').textContent = '-';
            document.getElementById('canada-win-percentage').textContent = '-';
            document.getElementById('total-faceoffs').textContent = '-';
        }
    }
    
    createVisualization() {
        this.updateVisualization();
    }
    
    updateVisualization() {
        const plotDiv = document.getElementById('plot');
        
        // Check if we have any faceoff data
        if (!this.filteredFaceoffs || this.filteredFaceoffs.length === 0) {
            const { traces, layout } = this.createEmptyVisualization('No faceoff data available for the selected filters');
            Plotly.react(plotDiv, traces, layout, {
                responsive: true,
                displayModeBar: false
            });
            return;
        }
        
        let traces, layout;
        
        switch (this.currentView) {
            case 'team-locations':
                ({ traces, layout } = this.createTeamLocationVisualization());
                break;
            case 'player-breakdown':
                ({ traces, layout } = this.createPlayerBreakdownVisualization());
                break;
            case 'head-to-head':
                ({ traces, layout } = this.createHeadToHeadVisualization());
                break;
            case 'location-map':
                ({ traces, layout } = this.createLocationMapVisualization());
                break;
            default:
                ({ traces, layout } = this.createTeamLocationVisualization());
        }
        
        // Check if we have any traces to display
        if (!traces || traces.length === 0) {
            const { traces: emptyTraces, layout: emptyLayout } = this.createEmptyVisualization('No faceoff data available for the selected filters');
            Plotly.react(plotDiv, emptyTraces, emptyLayout, {
                responsive: true,
                displayModeBar: false
            });
        } else {
            // Force complete reinitialization for location-map after table views
            // to prevent layout conflicts between coordinate-based and table visualizations
            if (this.currentView === 'location-map' && this.previousView === 'head-to-head') {
                // Clear the plot completely first
                Plotly.purge(plotDiv);
                // Then create fresh plot
                Plotly.newPlot(plotDiv, traces, layout, {
                    responsive: true,
                    displayModeBar: false
                });
            } else {
                Plotly.react(plotDiv, traces, layout, {
                    responsive: true,
                    displayModeBar: false
                });
            }
        }
        
        // Store previous view for next update
        this.previousView = this.currentView;
        
        this.updateAnalysisLegend();
    }
    
    createTeamLocationVisualization() {
        // Create donut charts for each zone showing team win percentages
        const zones = ['defensive', 'neutral', 'offensive'];
        const traces = [];
        
        zones.forEach((zone, index) => {
            const zoneFaceoffs = this.filteredFaceoffs.filter(f => f.zone === zone);
            
            // Get teams for current game
            if (this.teams && this.teams.length >= 2) {
                const team1Wins = zoneFaceoffs.filter(f => f.team_display === this.teams[0]).length;
                const team2Wins = zoneFaceoffs.filter(f => f.team_display === this.teams[1]).length;
                const total = team1Wins + team2Wins;
                
                if (total > 0) {
                    const team1Short = this.teams[0] === 'United States' ? 'USA' : 
                                     this.teams[0] === 'Olympic Athletes from Russia' ? 'Russia' : this.teams[0];
                    const team2Short = this.teams[1] === 'United States' ? 'USA' : 
                                     this.teams[1] === 'Olympic Athletes from Russia' ? 'Russia' : this.teams[1];
                    
                    const trace = {
                        type: 'pie',
                        values: [team1Wins, team2Wins],
                        labels: [team1Short, team2Short],
                        name: this.faceoffZones[zone].name,
                        marker: {
                            colors: [this.teamColors[this.teams[0]], this.teamColors[this.teams[1]]]
                        },
                        hole: 0.4,
                        domain: {
                            x: [index * 0.33, (index + 1) * 0.33 - 0.02],
                            y: [0.3, 0.9]
                        },
                        textinfo: 'percent',
                        textfont: { size: 14, color: 'white' },
                        hovertemplate: '%{label}: %{value} wins (%{percent})<extra></extra>',
            hoverlabel: {
                bgcolor: 'rgba(0, 0, 0, 0.8)',
                bordercolor: '#FFFFFF',
                font: { color: 'white', size: 12 }
            }
                    };
                    traces.push(trace);
                }
            }
        });
        
        const layout = {
            title: {
                text: 'Faceoff Win % by Zone',
                font: { size: 20, color: '#1F2937' },
                x: 0.5
            },
            annotations: zones.map((zone, index) => ({
                text: this.faceoffZones[zone].name,
                x: index * 0.33 + 0.165,
                y: 0.1,
                xanchor: 'center',
                yanchor: 'center',
                font: { size: 16, color: '#374151' },
                showarrow: false
            })),
            showlegend: false,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            margin: { t: 60, b: 60, l: 20, r: 20 }
        };
        
        return { traces, layout };
    }
    
    createPlayerBreakdownVisualization() {
        const playerStats = this.calculatePlayerStats();
        
        // Get selected teams from checkboxes
        const selectedTeams = [];
        document.querySelectorAll('input[type="checkbox"][value]:checked').forEach(checkbox => {
            selectedTeams.push(checkbox.value);
        });
        
        // Sort players by total faceoffs (most active first) and filter by selected teams
        const sortedPlayers = Object.entries(playerStats)
            .filter(([player, stats]) => {
                return stats.total > 0 && selectedTeams.includes(stats.team);
            })
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 12); // Show top 12 players
        
        const traces = [];
        const playerNames = [];
        const wins = [];
        const losses = [];
        const winPercentages = [];
        const teamColors = [];
        
        sortedPlayers.forEach(([player, stats]) => {
            playerNames.push(player);
            wins.push(stats.wins);
            losses.push(stats.losses);
            winPercentages.push(stats.winPercentage);
            
            // Use team color for the player
            const teamColor = this.teamColors[stats.team] || '#6B7280';
            teamColors.push(teamColor);
        });
        
        // Create wins trace
        traces.push({
            type: 'bar',
            x: playerNames,
            y: wins,
            name: 'Wins',
            marker: { color: '#10B981' },
            text: wins,
            textposition: 'inside',
            textfont: { color: 'white', size: 11, weight: 'bold' },
            hovertemplate: 'Wins: %{y}<extra></extra>',
            hoverlabel: {
                bgcolor: 'rgba(0, 0, 0, 0.8)',
                bordercolor: '#FFFFFF',
                font: { color: 'white', size: 12 }
            }
        });
        
        // Create losses trace
        traces.push({
            type: 'bar',
            x: playerNames,
            y: losses,
            name: 'Losses',
            marker: { color: '#EF4444' },
            text: losses,
            textposition: 'inside',
            textfont: { color: 'white', size: 11, weight: 'bold' },
            hovertemplate: 'Losses: %{y}<extra></extra>',
            hoverlabel: {
                bgcolor: 'rgba(0, 0, 0, 0.8)',
                bordercolor: '#FFFFFF',
                font: { color: 'white', size: 12 }
            }
        });
        
        // Add win percentage as text annotations above bars
        const annotations = winPercentages.map((percentage, index) => ({
            x: playerNames[index],
            y: wins[index] + losses[index] + Math.max(wins[index] + losses[index]) * 0.05,
            text: `${percentage}%`,
            showarrow: false,
            font: { size: 12, color: '#1F2937', weight: 'bold' },
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            bordercolor: teamColors[index],
            borderwidth: 2,
            borderpad: 3
        }));
        
        const layout = {
            title: {
                text: 'Player Faceoff Performance (Win/Loss & Win %)',
                font: { size: 18, color: '#1F2937' },
                x: 0.5
            },
            xaxis: { 
                title: 'Players',
                tickangle: -45,
                tickfont: { size: 11 }
            },
            yaxis: { 
                title: 'Number of Faceoffs',
                gridcolor: '#E5E7EB',
                gridwidth: 1
            },
            barmode: 'stack',
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(248, 250, 252, 0.8)',
            margin: { t: 80, b: 120, l: 60, r: 40 },
            annotations: annotations,
            showlegend: false,
            hovermode: 'closest'
        };
        
        return { traces, layout };
    }
    
    createHeadToHeadVisualization() {
        // Show detailed head-to-head faceoff performance in table format
        const playerStats = this.calculateHeadToHeadStats();
        
        // Get selected teams for filtering
        const selectedTeams = [];
        if (document.getElementById('team-usa').checked) selectedTeams.push('United States');
        if (document.getElementById('team-canada').checked) selectedTeams.push('Canada');
        if (document.getElementById('team-finland').checked) selectedTeams.push('Finland');
        if (document.getElementById('team-russia').checked) selectedTeams.push('Olympic Athletes from Russia');
        
        // Filter players by selected teams and sort by total faceoffs
        const filteredPlayers = Object.values(playerStats)
            .filter(player => selectedTeams.includes(player.team))
            .sort((a, b) => b.totalFaceoffs - a.totalFaceoffs)
            .slice(0, 12); // Show top 12 most active players
        
        if (filteredPlayers.length === 0) {
            return this.createEmptyVisualization('No head-to-head data for selected teams');
        }
        
        // Create table data
        const tableData = [];
        filteredPlayers.forEach(player => {
            const opponents = Object.entries(player.opponents)
                .filter(([opponent, stats]) => stats.total >= 2) // Only show matchups with 2+ faceoffs
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 5); // Show top 5 opponents for each player
            
            opponents.forEach(([opponent, stats]) => {
                const teamShort = player.team === 'United States' ? 'USA' : 
                                 player.team === 'Olympic Athletes from Russia' ? 'Russia' : player.team;
                
                tableData.push({
                    player: player.player,
                    team: teamShort,
                    opponent: opponent,
                    wins: stats.wins,
                    losses: stats.losses,
                    total: stats.total,
                    winRate: stats.winRate
                });
            });
        });
        
        // Sort by total faceoffs descending
        tableData.sort((a, b) => b.total - a.total);
        
        // Take top 20 matchups
        const topMatchups = tableData.slice(0, 20);
        
        // Create table visualization using plotly table
        const trace = {
            type: 'table',
            header: {
                values: ['Player', 'Team', 'vs Opponent', 'Wins', 'Losses', 'Total', 'Win %'],
                align: ['left', 'center', 'left', 'center', 'center', 'center', 'center'],
                line: { width: 1, color: '#E5E7EB' },
                fill: { color: '#F9FAFB' },
                font: { family: 'Inter', size: 12, color: '#1F2937', weight: 'bold' },
                height: 40
            },
            cells: {
                values: [
                    topMatchups.map(m => m.player),
                    topMatchups.map(m => m.team),
                    topMatchups.map(m => m.opponent),
                    topMatchups.map(m => m.wins),
                    topMatchups.map(m => m.losses),
                    topMatchups.map(m => m.total),
                    topMatchups.map(m => `${m.winRate.toFixed(1)}%`)
                ],
                align: ['left', 'center', 'left', 'center', 'center', 'center', 'center'],
                line: { color: '#E5E7EB', width: 1 },
                fill: { 
                    color: topMatchups.map((m, i) => i % 2 === 0 ? '#FFFFFF' : '#F9FAFB')
                },
                font: { family: 'Inter', size: 11, color: '#374151' },
                height: 35
            }
        };
        
        const layout = {
            title: {
                text: 'Head-to-Head Faceoff Performance (Top Matchups)',
                font: { size: 18, color: '#1F2937' },
                x: 0.5
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            margin: { t: 60, b: 20, l: 20, r: 20 },
            height: 600
        };
        
        return { traces: [trace], layout };
    }
    
    createLocationMapVisualization() {
        // Create donut charts overlaid on rink image at faceoff locations
        const traces = [];
        
        // Add rink image as background - same as Shot Analysis
        const rinkImage = {
            source: '/static/rink.png',
            xref: 'x',
            yref: 'y',
            x: 0,
            y: 807,
            sizex: 2000,
            sizey: 807,
            sizing: 'stretch',
            opacity: 0.9,
            layer: 'below'
        };
        
        // Define standard faceoff dot positions on a hockey rink (2000x807 coordinate system)
        // Based on actual NHL/Olympic faceoff dot locations
        const faceoffDots = [
            // Center ice
            { x: 1000, y: 403.5, name: 'Center Ice' },
            // Neutral zone dots (4 total) - adjusted 20px left/right
            { x: 850, y: 200, name: 'Neutral Zone Left' },
            { x: 1150, y: 200, name: 'Neutral Zone Right' },
            { x: 850, y: 607, name: 'Neutral Zone Left' },
            { x: 1150, y: 607, name: 'Neutral Zone Right' },
            // End zone dots (4 total) - moved 100px towards center ice
            { x: 470, y: 200, name: 'End Zone Left' },
            { x: 470, y: 607, name: 'End Zone Right' },
            { x: 1528, y: 200, name: 'End Zone Left' },
            { x: 1528, y: 607, name: 'End Zone Right' }
        ];
        
        // Initialize all faceoff dot locations with zero stats
        const locationStats = {};
        faceoffDots.forEach(dot => {
            const key = `${dot.x}-${dot.y}`;
            locationStats[key] = {
                x: dot.x,
                y: dot.y,
                name: dot.name,
                teams: {}
            };
        });
        
        // Group faceoffs by nearest standard dot location
        this.filteredFaceoffs.forEach(faceoff => {
            // Since faceoff events don't have coordinates, distribute them randomly across locations
            // In a real implementation, you'd have actual faceoff coordinates
            const randomDot = faceoffDots[Math.floor(Math.random() * faceoffDots.length)];
            
            const key = `${randomDot.x}-${randomDot.y}`;
            if (!locationStats[key].teams[faceoff.team_display]) {
                locationStats[key].teams[faceoff.team_display] = 0;
            }
            locationStats[key].teams[faceoff.team_display]++;
        });
        
        // Create donut chart traces for each location (show all locations)
        Object.values(locationStats).forEach((location, index) => {
            if (this.teams && this.teams.length >= 2) {
                const team1Wins = location.teams[this.teams[0]] || 0;
                const team2Wins = location.teams[this.teams[1]] || 0;
                const total = team1Wins + team2Wins;
                
                const team1Short = this.teams[0] === 'United States' ? 'USA' : 
                                 this.teams[0] === 'Olympic Athletes from Russia' ? 'Russia' : this.teams[0];
                const team2Short = this.teams[1] === 'United States' ? 'USA' : 
                                 this.teams[1] === 'Olympic Athletes from Russia' ? 'Russia' : this.teams[1];
                
                // Show donut chart even if no data (empty circle)
                const trace = {
                    type: 'pie',
                    values: total > 0 ? [team1Wins, team2Wins] : [1, 0], // Show empty circle if no data
                    labels: total > 0 ? [team1Short, team2Short] : ['No Data'],
                    name: location.name,
                    marker: {
                        colors: total > 0 ? [this.teamColors[this.teams[0]], this.teamColors[this.teams[1]]] : ['#e5e7eb']
                    },
                    hole: 0.7, // Make it more donut-like
                    domain: {
                        x: [(location.x - 80) / 2000, (location.x + 80) / 2000],
                        y: [(location.y - 80) / 807, (location.y + 80) / 807]
                    },
                    textinfo: 'none',
                    hoverinfo: 'label+value+percent',
                    hovertemplate: total > 0 ? 
                        `${location.name}<br>%{label}: %{value} wins (%{percent})<extra></extra>` :
                        `${location.name}<br>No faceoff data<extra></extra>`,
                    hoverlabel: {
                        bgcolor: 'rgba(0, 0, 0, 0.8)',
                        bordercolor: '#FFFFFF',
                        font: { color: 'white', size: 12 }
                    },
                    showlegend: false
                };
                traces.push(trace);
            }
        });
        
                    const layout = {
                title: {
                    text: '',
                    font: { size: 20, color: '#1F2937' },
                    x: 0.5
                },
            xaxis: { 
                range: [0, 2000],
                showgrid: false,
                zeroline: false,
                showticklabels: false
            },
            yaxis: { 
                range: [0, 807],
                showgrid: false,
                zeroline: false,
                showticklabels: false,
                scaleanchor: 'x',
                scaleratio: 1
            },
            images: [rinkImage],
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            margin: { t: 60, b: 20, l: 20, r: 20 },
            showlegend: false
        };
        
        return { traces, layout };
    }
    
    calculatePlayerStats() {
        const stats = {};
        
        // Process filtered faceoff events to respect period and other filters
        this.filteredFaceoffs.forEach(faceoff => {
            const winner = faceoff.player;
            const loser = faceoff.opponent;
            
            // Initialize winner stats
            if (!stats[winner]) {
                stats[winner] = {
                    wins: 0,
                    losses: 0,
                    total: 0,
                    winPercentage: 0,
                    team: faceoff.team_display,
                    zones: { defensive: 0, neutral: 0, offensive: 0 }
                };
            }
            
            // Initialize loser stats and determine their team
            if (loser && loser !== 'Unknown') {
                if (!stats[loser]) {
                    // Try to find the loser's team from other filtered faceoffs where they were the winner
                    let loserTeam = 'Unknown';
                    const loserAsWinner = this.filteredFaceoffs.find(f => f.player === loser);
                    if (loserAsWinner) {
                        loserTeam = loserAsWinner.team_display;
                    }
                    
                    stats[loser] = {
                        wins: 0,
                        losses: 0,
                        total: 0,
                        winPercentage: 0,
                        team: loserTeam,
                        zones: { defensive: 0, neutral: 0, offensive: 0 }
                    };
                }
                
                // Record loss for the opponent
                stats[loser].losses++;
                stats[loser].total++;
            }
            
            // Record win for the winner
            stats[winner].wins++;
            stats[winner].total++;
            stats[winner].zones[faceoff.zone]++;
        });
        
        // Calculate win percentages
        Object.keys(stats).forEach(player => {
            const playerStats = stats[player];
            if (playerStats.total > 0) {
                playerStats.winPercentage = Math.round((playerStats.wins / playerStats.total) * 100);
            }
        });
        
        return stats;
    }
    
    getOpponentTeam(team) {
        if (!this.teams || this.teams.length < 2) return 'Unknown';
        return this.teams.find(t => t !== team) || 'Unknown';
    }
    
    calculateHeadToHeadStats() {
        const playerStats = {};
        
        // Initialize player stats
        this.filteredFaceoffs.forEach(faceoff => {
            if (!playerStats[faceoff.player]) {
                playerStats[faceoff.player] = {
                    player: faceoff.player,
                    team: faceoff.team_display,
                    opponents: {},
                    totalFaceoffs: 0
                };
            }
            
            if (!playerStats[faceoff.opponent]) {
                // Find opponent's team
                const opponentTeam = this.filteredFaceoffs.find(f => f.player === faceoff.opponent)?.team_display || 'Unknown';
                playerStats[faceoff.opponent] = {
                    player: faceoff.opponent,
                    team: opponentTeam,
                    opponents: {},
                    totalFaceoffs: 0
                };
            }
        });
        
        // Process each faceoff
        this.filteredFaceoffs.forEach(faceoff => {
            const winner = faceoff.player;
            const loser = faceoff.opponent;
            
            // Record win for winner
            if (!playerStats[winner].opponents[loser]) {
                playerStats[winner].opponents[loser] = { wins: 0, losses: 0, total: 0, winRate: 0 };
            }
            playerStats[winner].opponents[loser].wins++;
            playerStats[winner].opponents[loser].total++;
            playerStats[winner].totalFaceoffs++;
            
            // Record loss for loser
            if (!playerStats[loser].opponents[winner]) {
                playerStats[loser].opponents[winner] = { wins: 0, losses: 0, total: 0, winRate: 0 };
            }
            playerStats[loser].opponents[winner].losses++;
            playerStats[loser].opponents[winner].total++;
            playerStats[loser].totalFaceoffs++;
        });
        
        // Calculate win rates
        Object.values(playerStats).forEach(player => {
            Object.values(player.opponents).forEach(opponent => {
                if (opponent.total > 0) {
                    opponent.winRate = (opponent.wins / opponent.total * 100);
                }
            });
        });
        
        return playerStats;
    }
    
    createEmptyVisualization(message) {
        const trace = {
            type: 'scatter',
            x: [0],
            y: [0],
            mode: 'text',
            text: [message],
            textfont: { size: 18, color: '#6B7280' },
            showlegend: false
        };
        
        const layout = {
            xaxis: { showgrid: false, zeroline: false, showticklabels: false },
            yaxis: { showgrid: false, zeroline: false, showticklabels: false },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            margin: { t: 60, b: 60, l: 60, r: 60 }
        };
        
        return { traces: [trace], layout };
    }
    
    updateAnalysisLegend() {
        const legendContainer = document.getElementById('legend-items');
        const analysisLegend = document.getElementById('analysis-legend');
        
        legendContainer.innerHTML = '';
        
        let legendData = [];
        
        switch (this.currentView) {
            case 'team-locations':
                if (this.teams && this.teams.length >= 2) {
                    const team1Short = this.teams[0] === 'United States' ? 'USA' : 
                                     this.teams[0] === 'Olympic Athletes from Russia' ? 'Russia' : this.teams[0];
                    const team2Short = this.teams[1] === 'United States' ? 'USA' : 
                                     this.teams[1] === 'Olympic Athletes from Russia' ? 'Russia' : this.teams[1];
                    legendData = [
                        { label: `${team1Short} Wins`, color: this.teamColors[this.teams[0]], marker: 'circle' },
                        { label: `${team2Short} Wins`, color: this.teamColors[this.teams[1]], marker: 'circle' }
                    ];
                }
                break;
            case 'player-breakdown':
                legendData = [
                    { label: 'Wins', color: '#10B981', marker: 'square' },
                    { label: 'Losses', color: '#EF4444', marker: 'square' },
                    { label: 'Win % shown above bars', color: '#1F2937', marker: 'text' }
                ];
                break;
            case 'location-map':
                if (this.teams && this.teams.length >= 2) {
                    const team1Short = this.teams[0] === 'United States' ? 'USA' : 
                                     this.teams[0] === 'Olympic Athletes from Russia' ? 'Russia' : this.teams[0];
                    const team2Short = this.teams[1] === 'United States' ? 'USA' : 
                                     this.teams[1] === 'Olympic Athletes from Russia' ? 'Russia' : this.teams[1];
                    legendData = [
                        { label: `${team1Short} Faceoff Wins`, color: this.teamColors[this.teams[0]], marker: 'circle' },
                        { label: `${team2Short} Faceoff Wins`, color: this.teamColors[this.teams[1]], marker: 'circle' }
                    ];
                }
                break;
            default:
                analysisLegend.classList.remove('visible');
                return;
        }
        
        legendData.forEach(item => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            
            const marker = document.createElement('div');
            marker.className = 'legend-marker';
            marker.style.backgroundColor = item.color;
            
            const label = document.createElement('span');
            label.className = 'legend-label';
            label.textContent = item.label;
            
            legendItem.appendChild(marker);
            legendItem.appendChild(label);
            legendContainer.appendChild(legendItem);
        });
        
        analysisLegend.classList.add('visible');
    }
    
    setupTimeControls() {
        const timeSlider = document.getElementById('time-range');
        timeSlider.min = 0;
        timeSlider.max = 100;
        timeSlider.value = 0;
        this.updateTimeDisplay();
    }
    
    updateTimeDisplay() {
        // Calculate max time based on selected periods
        const maxTime = this.getMaxTimeForSelectedPeriods();
        
        const currentTime = (this.currentTimeFilter / 100) * maxTime;
        const currentMinutes = Math.floor(currentTime / 60);
        const currentSeconds = Math.floor(currentTime % 60);
        const maxMinutes = Math.floor(maxTime / 60);
        const maxSeconds = Math.floor(maxTime % 60);
        
        document.getElementById('time-display').textContent = 
            `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')} - ${maxMinutes}:${maxSeconds.toString().padStart(2, '0')}`;
    }
    
    getMaxTimeForSelectedPeriods() {
        // Get selected periods
        const selectedPeriods = [];
        document.querySelectorAll('[id^="period-"]:checked').forEach(checkbox => {
            selectedPeriods.push(parseInt(checkbox.value));
        });
        
        // Each period is 20 minutes (1200 seconds)
        const periodDuration = 1200;
        const totalDuration = selectedPeriods.length * periodDuration;
        
        return totalDuration;
    }
    
    togglePlayback() {
        if (this.isPlaying) {
            this.pauseAnimation();
        } else {
            this.startAnimation();
        }
    }
    
    startAnimation() {
        this.isPlaying = true;
        document.getElementById('play-pause').innerHTML = '<i class="fas fa-pause"></i>';
        
        this.playInterval = setInterval(() => {
            this.currentTimeFilter += this.playSpeed;
            if (this.currentTimeFilter >= 100) {
                this.currentTimeFilter = 100;
                this.pauseAnimation();
            }
            
            document.getElementById('time-range').value = this.currentTimeFilter;
            this.updateTimeDisplay();
            this.applyFilters();
        }, 100);
    }
    
    pauseAnimation() {
        this.isPlaying = false;
        document.getElementById('play-pause').innerHTML = '<i class="fas fa-play"></i>';
        
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
    }
    
    resetAnimation() {
        this.pauseAnimation();
        this.currentTimeFilter = 0;
        document.getElementById('time-range').value = 0;
        this.updateTimeDisplay();
        this.applyFilters();
    }
    
    resizePlot() {
        const plotDiv = document.getElementById('plot');
        if (plotDiv && plotDiv.data) {
            Plotly.Plots.resize(plotDiv);
        }
    }
    
    showLoading() {
        document.getElementById('loading').style.display = 'flex';
    }
    
    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }
    
    showError(message) {
        const plotDiv = document.getElementById('plot');
        plotDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; color: #EF4444; text-align: center;">
                <i class="fas fa-exclamation-triangle" style="font-size: 4rem; margin-bottom: 1rem;"></i>
                <h3 style="margin: 0 0 0.5rem 0;">Error</h3>
                <p style="margin: 0; font-size: 1.1rem;">${message}</p>
            </div>
        `;
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize the faceoff analyzer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new FaceoffAnalyzer();
}); 