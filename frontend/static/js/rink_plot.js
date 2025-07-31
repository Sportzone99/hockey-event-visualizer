// Modern Hockey Event Visualizer - Enhanced Interface
class HockeyVisualizer {
    constructor() {
        this.allEvents = [];
        this.allShots = [];
        this.filteredShots = [];
        this.currentTimeFilter = 0;
        this.isPlaying = false;
        this.playInterval = null;
        this.playSpeed = 5;
        this.timeRange = { min: 0, max: 1200 };
        this.teams = [];
        this.games = [];
        this.currentGame = null;
        this.players = { 'United States': [], 'Canada': [], 'Finland': [], 'Olympic Athletes from Russia': [] };
        this.currentShotView = 'for-against';
        
        this.eventTypeSymbols = {
            'Faceoff Win': 'circle',
            'Puck Recovery': 'square',
            'Zone Entry': 'triangle-up',
            'Dump In/Out': 'diamond',
            'Play': 'arrow-right',
            'Takeaway': 'x',
            'Incomplete Play': 'cross',
            'Shot': 'star',
            'Goal': 'star-triangle-up',
            'Penalty Taken': 'hexagon'
        };
        
        // Shot zone definitions (based on hockey analytics standards)
        this.shotZones = {
            innerSlot: { name: 'Inner Slot', color: '#DC2626', dangerLevel: 'extreme' },
            slot: { name: 'Slot', color: '#EF4444', dangerLevel: 'high' },
            outerSlot: { name: 'Outer Slot', color: '#F97316', dangerLevel: 'medium' },
            outside: { name: 'Outside', color: '#6B7280', dangerLevel: 'low' }
        };
        
        this.shotOutcomeColors = {
            'Goal': '#DC2626',
            'On Net': '#EF4444', 
            'Blocked': '#F59E0B',
            'Missed': '#6B7280'
        };
        
        this.shotTypeColors = {
            'Wristshot': '#3B82F6',
            'Snapshot': '#10B981',
            'Slapshot': '#8B5CF6',
            'Deflection': '#F97316',
            'Wrap around': '#06B6D4',
            'Fan': '#6B7280'
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
        console.log('HockeyVisualizer init() called');
        try {
            console.log('Loading initial data...');
            await this.loadInitialData();
            console.log('Setting up event listeners...');
            this.setupEventListeners();
            console.log('Creating visualization...');
            this.createVisualization();
            
            // Hide loading after plot is created and resized
            setTimeout(() => {
            this.hideLoading();
            }, 200);
        } catch (error) {
            console.error('Error initializing visualizer:', error);
            this.showError('Failed to load hockey data');
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
            const [eventsData, teamsData, eventTypesData, playersData, statsData, timeRangeData] = await Promise.all([
                fetch(`/api/events?game=${encodeURIComponent(this.currentGame)}`).then(res => res.json()),
                fetch(`/api/teams?game=${encodeURIComponent(this.currentGame)}`).then(res => res.json()),
            fetch('/api/events/types').then(res => res.json()),
                fetch('/api/players').then(res => res.json()),
            fetch('/api/stats').then(res => res.json()),
            fetch('/api/time-range').then(res => res.json())
        ]);
        
        this.allEvents = eventsData;
            
            // Filter to only shots and goals, add zone analysis
            this.allShots = eventsData.filter(event => 
                event.event === 'Shot' || event.event === 'Goal'
            ).map(shot => ({
                ...shot,
                shotZone: this.determineShotZone(shot.x_coordinate, shot.y_coordinate),
                shotOutcome: shot.event === 'Goal' ? 'Goal' : (shot.detail_2 || 'Unknown')
            }));
            
            this.filteredShots = [...this.allShots];
            this.teams = teamsData;
            this.timeRange = {
                min: timeRangeData.min_seconds,
                max: timeRangeData.max_seconds
            };
            
            this.organizePlayersByTeam(eventsData);
            this.populateShotFilters();
            this.updatePlayerDropdowns();
            this.applyShotFilters();
        this.setupTimeControls();
            
        } catch (error) {
            throw new Error('Failed to load initial data: ' + error.message);
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
        const [eventsData, teamsData, playersData, statsData, timeRangeData] = await Promise.all([
            fetch(`/api/events?game=${encodeURIComponent(this.currentGame)}`).then(res => res.json()),
            fetch(`/api/teams?game=${encodeURIComponent(this.currentGame)}`).then(res => res.json()),
            fetch('/api/players').then(res => res.json()),
            fetch('/api/stats').then(res => res.json()),
            fetch('/api/time-range').then(res => res.json())
        ]);
        
        this.allEvents = eventsData;
        
        // Filter to only shots and goals, add zone analysis
        this.allShots = eventsData.filter(event => 
            event.event === 'Shot' || event.event === 'Goal'
        ).map(shot => ({
            ...shot,
            shotZone: this.determineShotZone(shot.x_coordinate, shot.y_coordinate),
            shotOutcome: shot.event === 'Goal' ? 'Goal' : (shot.detail_2 || 'Unknown')
        }));
        
        this.filteredShots = [...this.allShots];
        this.teams = teamsData;
        this.timeRange = {
            min: timeRangeData.min_seconds,
            max: timeRangeData.max_seconds
        };
        
        this.organizePlayersByTeam(eventsData);
        this.populateShotFilters();
        this.updateTeamCheckboxes();
        this.updatePlayerDropdowns();
        this.applyShotFilters();
        this.setupTimeControls();
    }
    
    showGameSelectionMessage() {
        const plotDiv = document.getElementById('plot');
        plotDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; color: #6B7280; text-align: center;">
                <i class="fas fa-hockey-puck" style="font-size: 4rem; margin-bottom: 1rem; color: #E5E7EB;"></i>
                <h3 style="margin: 0 0 0.5rem 0; color: #374151;">Welcome to Hockey Analytics</h3>
                <p style="margin: 0; font-size: 1.1rem;">Please select a game from the dropdown above to begin analysis</p>
            </div>
        `;
        
        // Clear stats
        document.getElementById('team1-shots').textContent = '-';
        document.getElementById('team2-shots').textContent = '-';
        document.getElementById('shooting-percentage').textContent = '-';
        document.getElementById('filtered-events').textContent = '-';
        document.getElementById('active-player-count').textContent = '-';
    }
    
    determineShotZone(x, y) {
        // Hockey rink coordinates: 0-200 (length), 0-85 (width)
        // Goals are at x=0 and x=200, center of rink is y=42.5
        
        if (!x || !y) return 'outside';
        
        // Determine which end of rink (closer to which goal)
        const distanceToLeftGoal = Math.sqrt(Math.pow(x - 0, 2) + Math.pow(y - 42.5, 2));
        const distanceToRightGoal = Math.sqrt(Math.pow(x - 200, 2) + Math.pow(y - 42.5, 2));
        
        // Use distance to closest goal
        const distanceToGoal = Math.min(distanceToLeftGoal, distanceToRightGoal);
        const goalY = 42.5; // Center of goal
        
        // Calculate angle from goal center
        let goalX = distanceToLeftGoal < distanceToRightGoal ? 0 : 200;
        let angleFromGoal = Math.abs(Math.atan2(y - goalY, Math.abs(x - goalX)) * 180 / Math.PI);
        
        // Define zones based on distance and angle (coach-friendly zones)
        if (distanceToGoal <= 15 && angleFromGoal <= 30) {
            return 'innerSlot';
        } else if (distanceToGoal <= 25 && angleFromGoal <= 45) {
            return 'slot';
        } else if (distanceToGoal <= 40 && angleFromGoal <= 60) {
            return 'outerSlot';
        } else {
            return 'outside';
        }
    }
    
    organizePlayersByTeam(events) {
        // Group players by team (reset for current game)
        this.players = { 
            'United States': [], 
            'Canada': [],
            'Finland': [],
            'Olympic Athletes from Russia': []
        };
        
        events.forEach(event => {
            const team = event.team_display;
            const player = event.player;
            
            if (team && player && this.players[team] && !this.players[team].includes(player)) {
                this.players[team].push(player);
            }
        });
        
        // Sort players alphabetically
        Object.keys(this.players).forEach(team => {
            this.players[team].sort();
        });
    }
    
    showLoading() {
        document.getElementById('loading').style.display = 'flex';
    }
    
    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }
    
    populateShotFilters() {
        // Shot types from our data
        const shotTypes = [...new Set(this.allShots.map(shot => shot.detail_1).filter(type => type))];
        const typeSelect = document.getElementById('shot-type-filter');
        
        shotTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.toLowerCase();
            option.textContent = type;
            typeSelect.appendChild(option);
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
                select.addEventListener('change', () => this.applyShotFilters());
                
                dropdownsContainer.appendChild(select);
            });
        }
    }
    
    updateTeamCheckboxes() {
        const checkboxContainer = document.querySelector('.checkbox-group');
        
        // Clear existing checkboxes
        checkboxContainer.innerHTML = '';
        
        // Create checkboxes for current game's teams
        if (this.teams && this.teams.length > 0) {
            this.teams.forEach(team => {
                const shortName = team === 'United States' ? 'USA' : 
                                team === 'Olympic Athletes from Russia' ? 'Russia' : team;
                const id = `team-${team.toLowerCase().replace(/\s+/g, '-')}`;
                
                const label = document.createElement('label');
                label.className = 'checkbox-item';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = id;
                checkbox.value = team;
                checkbox.checked = true;
                checkbox.addEventListener('change', () => this.applyShotFilters());
                
                const checkmark = document.createElement('span');
                checkmark.className = 'checkmark';
                
                const labelText = document.createElement('span');
                labelText.className = 'checkbox-label';
                labelText.textContent = shortName;
                
                label.appendChild(checkbox);
                label.appendChild(checkmark);
                label.appendChild(labelText);
                checkboxContainer.appendChild(label);
            });
        }
    }
    
    getSelectedTeams() {
        const selectedTeams = [];
        
        // Dynamically find team checkboxes
        const teamCheckboxes = document.querySelectorAll('input[type="checkbox"][id^="team-"]:checked');
        teamCheckboxes.forEach(checkbox => {
            selectedTeams.push(checkbox.value);
        });
        
        return selectedTeams;
    }
    
    getSelectedPeriods() {
        const selectedPeriods = [];
        
        if (document.getElementById('period-1').checked) selectedPeriods.push(1);
        if (document.getElementById('period-2').checked) selectedPeriods.push(2);
        if (document.getElementById('period-3').checked) selectedPeriods.push(3);
        
        return selectedPeriods;
    }
    
    getSelectedPlayers() {
        const selectedPlayers = [];
        const playerSelects = document.querySelectorAll('.player-select');
        
        playerSelects.forEach(select => {
            if (select.value) {
                selectedPlayers.push(select.value);
            }
        });
        
        return selectedPlayers;
    }
    
    setupEventListeners() {
        console.log('setupEventListeners() called');
        // Shot view switcher
        document.querySelectorAll('.shot-view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.shot-view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentShotView = btn.dataset.view;
                this.updateVisualization();
            });
        });
        
        // Shot filters
        document.getElementById('shot-outcome-filter').addEventListener('change', () => this.applyShotFilters());
        document.getElementById('shot-type-filter').addEventListener('change', () => this.applyShotFilters());
        document.getElementById('traffic-filter').addEventListener('change', () => this.applyShotFilters());
        document.getElementById('game-situation-filter').addEventListener('change', () => this.applyShotFilters());
        
        // Team checkbox listeners
        const teamUsaCheckbox = document.getElementById('team-usa');
        if (teamUsaCheckbox) {
            teamUsaCheckbox.addEventListener('change', () => {
                this.updatePlayerDropdowns();
                this.applyShotFilters();
            });
        }
        
        const teamCanadaCheckbox = document.getElementById('team-canada');
        if (teamCanadaCheckbox) {
            teamCanadaCheckbox.addEventListener('change', () => {
                this.updatePlayerDropdowns();
                this.applyShotFilters();
            });
        }
        
        // Period checkbox listeners
        document.getElementById('period-1').addEventListener('change', () => this.applyShotFilters());
        document.getElementById('period-2').addEventListener('change', () => this.applyShotFilters());
        document.getElementById('period-3').addEventListener('change', () => this.applyShotFilters());
        
        // Animation controls
        const playPauseBtn = document.getElementById('play-pause');
        console.log('Looking for play-pause button:', playPauseBtn);
        if (playPauseBtn) {
            console.log('Adding click listener to play button');
            playPauseBtn.addEventListener('click', () => {
                console.log('Play button clicked!');
                this.togglePlayback();
            });
        } else {
            console.error('play-pause button not found when setting up event listeners!');
        }
        const resetBtn = document.getElementById('reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetAnimation());
        }
        
        const speedControl = document.getElementById('speed-control');
        if (speedControl) {
            speedControl.addEventListener('input', (e) => this.setPlaySpeed(e.target.value));
        }
        const timeRange = document.getElementById('time-range');
        if (timeRange) {
            timeRange.addEventListener('input', (e) => this.setTimeFilter(e.target.value));
        }
        
        // Window resize handler
        window.addEventListener('resize', this.debounce(() => this.resizePlot(), 250));
    }
    
    async applyShotFilters() {
        try {
            const selectedTeams = this.getSelectedTeams();
            const selectedPeriods = this.getSelectedPeriods();
            const selectedPlayers = this.getSelectedPlayers();
            const shotOutcome = document.getElementById('shot-outcome-filter').value;
            const shotType = document.getElementById('shot-type-filter').value;
            const traffic = document.getElementById('traffic-filter').value;
            const gameSituation = document.getElementById('game-situation-filter').value;
            
            // Filter shots locally for better performance
            this.filteredShots = this.allShots.filter(shot => {
                // Team filter
                if (selectedTeams.length > 0 && !selectedTeams.includes(shot.team_display)) {
                    return false;
                }
                
                // Period filter
                if (selectedPeriods.length > 0 && !selectedPeriods.includes(shot.period)) {
                    return false;
                }
                
                // Player filter
                if (selectedPlayers.length > 0 && !selectedPlayers.includes(shot.player)) {
                    return false;
                }
                
                // Shot outcome filter
                if (shotOutcome !== 'all') {
                    if (shotOutcome === 'goal' && shot.event !== 'Goal') {
                        return false;
                    } else if (shotOutcome === 'on-net' && shot.detail_2 !== 'On Net') {
                        return false;
                    } else if (shotOutcome === 'blocked' && shot.detail_2 !== 'Blocked') {
                        return false;
                    } else if (shotOutcome === 'missed' && shot.detail_2 !== 'Missed') {
                        return false;
                    }
                }
                
                // Shot type filter
                if (shotType !== 'all' && shot.detail_1 && shot.detail_1.toLowerCase() !== shotType) {
                    return false;
                }
                
                // Traffic filter
                if (traffic !== 'all') {
                    if (traffic === 'true' && shot.detail_3 !== 'true') {
                        return false;
                    } else if (traffic === 'false' && shot.detail_3 !== 'false') {
                        return false;
                    }
                }
                
                // Game situation filter
                if (gameSituation !== 'all') {
                    const situation = this.getGameSituation(shot);
                    if (situation !== gameSituation) {
                        return false;
                    }
                }
                
                return true;
            });
            
            this.updateVisualization();
            this.updateShotStats();
            
            // Update time display to reflect selected periods
            const timeSlider = document.getElementById('time-range');
            this.updateTimeDisplay(parseFloat(timeSlider.value));
            
        } catch (error) {
            console.error('Error applying shot filters:', error);
        }
    }
    
    getGameSituation(shot) {
        // Default to '5v5' if skater data is not available
        if (!shot.home_team_skaters || !shot.away_team_skaters) {
            return '5v5';
        }
        
        const homeSkaters = parseInt(shot.home_team_skaters);
        const awaySkaters = parseInt(shot.away_team_skaters);
        
        // Determine which team is USA/Canada based on shot team
        // Note: This assumes home team is always Canada for our dataset
        const isUSAHome = shot.home_team && shot.home_team.includes('United States');
        const isShotByUSA = shot.team_display === 'United States';
        
        if (homeSkaters === awaySkaters && homeSkaters === 5) {
            return '5v5';
        } else if (isUSAHome) {
            // USA is home team
            if (isShotByUSA && homeSkaters > awaySkaters) {
                return 'usa-powerplay';
            } else if (!isShotByUSA && awaySkaters > homeSkaters) {
                return 'canada-powerplay';
            }
        } else {
            // Canada is home team (typical for our dataset)
            if (isShotByUSA && awaySkaters > homeSkaters) {
                return 'usa-powerplay';
            } else if (!isShotByUSA && homeSkaters > awaySkaters) {
                return 'canada-powerplay';
            }
        }
        
        // Default to 5v5 for any other situation
        return '5v5';
    }
    
    updateShotStats() {
        // Update filtered events count (now shots)
        document.getElementById('filtered-events').textContent = this.filteredShots.length.toLocaleString();
        
        // Count unique players in filtered shots
        const uniquePlayers = new Set(this.filteredShots.map(shot => shot.player)).size;
        document.getElementById('active-player-count').textContent = uniquePlayers;
        
        // Update shot-specific stats for current game teams
        if (this.teams && this.teams.length >= 2) {
            const team1Shots = this.filteredShots.filter(shot => shot.team_display === this.teams[0]);
            const team2Shots = this.filteredShots.filter(shot => shot.team_display === this.teams[1]);
            const goals = this.filteredShots.filter(shot => shot.event === 'Goal');
            
            // Update stat labels and values dynamically
            const team1Short = this.teams[0] === 'United States' ? 'USA' : 
                             this.teams[0] === 'Olympic Athletes from Russia' ? 'Russia' : this.teams[0];
            const team2Short = this.teams[1] === 'United States' ? 'USA' : 
                             this.teams[1] === 'Olympic Athletes from Russia' ? 'Russia' : this.teams[1];
            
            document.getElementById('team1-label').textContent = `${team1Short} Shots`;
            document.getElementById('team2-label').textContent = `${team2Short} Shots`;
            
            document.getElementById('team1-shots').textContent = team1Shots.length;
            document.getElementById('team2-shots').textContent = team2Shots.length;
            
            // Update stat card colors to match team colors
            const team1Card = document.querySelector('.stat-card.team1');
            const team2Card = document.querySelector('.stat-card.team2');
            
            if (team1Card && this.teamColors[this.teams[0]]) {
                team1Card.style.borderColor = this.teamColors[this.teams[0]];
                team1Card.style.background = `${this.teamColors[this.teams[0]]}10`;
            }
            
            if (team2Card && this.teamColors[this.teams[1]]) {
                team2Card.style.borderColor = this.teamColors[this.teams[1]];
                team2Card.style.background = `${this.teamColors[this.teams[1]]}10`;
            }
            
            // Calculate overall shooting percentage
            const shootingPercentage = this.filteredShots.length > 0 ? 
                Math.round((goals.length / this.filteredShots.length) * 100) : 0;
            document.getElementById('shooting-percentage').textContent = shootingPercentage + '%';
        } else {
            // Default values if teams not loaded
            document.getElementById('team1-shots').textContent = '-';
            document.getElementById('team2-shots').textContent = '-';
            document.getElementById('shooting-percentage').textContent = '-';
        }
        
    }
    
    setupTimeControls() {
        const timeSlider = document.getElementById('time-range');
        timeSlider.min = 0;
        timeSlider.max = 100;
        timeSlider.value = 0;
        
        this.updateTimeDisplay(0);
    }
    
    updateTimeDisplay(percentage) {
        // Calculate max time based on selected periods
        const maxTime = this.getMaxTimeForSelectedPeriods();
        
        const currentTime = this.timeRange.min + (maxTime - this.timeRange.min) * (percentage / 100);
        const startTime = this.secondsToTimeString(this.timeRange.min);
        const endTime = this.secondsToTimeString(maxTime);
        const currentTimeStr = this.secondsToTimeString(currentTime);
        
        document.getElementById('time-display').textContent = `${currentTimeStr} / ${endTime}`;
    }
    
    getMaxTimeForSelectedPeriods() {
        // Get selected periods
        const selectedPeriods = [];
        if (document.getElementById('period-1').checked) selectedPeriods.push(1);
        if (document.getElementById('period-2').checked) selectedPeriods.push(2);
        if (document.getElementById('period-3').checked) selectedPeriods.push(3);
        
        // Each period is 20 minutes (1200 seconds)
        const periodDuration = 1200;
        const totalDuration = selectedPeriods.length * periodDuration;
        
        return totalDuration;
    }
    
    secondsToTimeString(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    togglePlayback() {
        console.log('togglePlayback called - isPlaying:', this.isPlaying);
        const button = document.getElementById('play-pause');
        const icon = button.querySelector('i');
        
        if (this.isPlaying) {
            console.log('Pausing animation');
            this.pauseAnimation();
            icon.className = 'fas fa-play';
        } else {
            console.log('Starting animation');
            this.startAnimation();
            icon.className = 'fas fa-pause';
        }
        console.log('After toggle - isPlaying:', this.isPlaying);
    }
    
    startAnimation() {
        console.log('startAnimation() called');
        this.isPlaying = true;
        console.log('Set isPlaying to true');
        const timeSlider = document.getElementById('time-range');
        console.log('timeSlider element:', timeSlider);
        
        this.playInterval = setInterval(() => {
            console.log('Animation interval running');
            let currentValue = parseFloat(timeSlider.value);
            console.log('Current slider value:', currentValue);
            currentValue += this.playSpeed * 0.5;
            console.log('New value after increment:', currentValue);
            
            if (currentValue >= 100) {
                currentValue = 100;
                this.pauseAnimation();
                document.getElementById('play-pause').querySelector('i').className = 'fas fa-play';
                console.log('Animation reached 100%, stopping');
            }
            
            timeSlider.value = currentValue;
            this.setTimeFilter(currentValue);
        }, 100);
    }
    
    pauseAnimation() {
        this.isPlaying = false;
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
    }
    
    resetAnimation() {
        this.pauseAnimation();
        document.getElementById('time-range').value = 0;
        document.getElementById('play-pause').querySelector('i').className = 'fas fa-play';
        this.setTimeFilter(0);
    }
    
    setPlaySpeed(speed) {
        this.playSpeed = parseFloat(speed);
    }
    
    setTimeFilter(percentage) {
        console.log('setTimeFilter called with percentage:', percentage);
        this.currentTimeFilter = parseFloat(percentage);
        console.log('Set currentTimeFilter to:', this.currentTimeFilter);
        this.updateTimeDisplay(this.currentTimeFilter);
        this.updateVisualization();
    }
    
    createVisualization() {
        const plotDiv = document.getElementById('plot');
        
        if (!plotDiv) {
            console.error('Plot div not found!');
            return;
        }
        
        console.log('Creating visualization with plot div:', plotDiv);
        
        // Create hockey rink with actual rink image
        const rinkLayout = {
            title: '',
            showlegend: false,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: '#f8fafc',
            margin: { l: 20, r: 20, t: 20, b: 20 },
            xaxis: {
                range: [0, 2000],
                showgrid: false,
                showticklabels: false,
                zeroline: false,
                fixedrange: true
            },
            yaxis: {
                range: [0, 807],
                showgrid: false,
                showticklabels: false,
                zeroline: false,
                fixedrange: true,
                scaleanchor: 'x',
                scaleratio: 1
            },
            images: [{
                source: "/static/rink.png",
                xref: "x",
                yref: "y", 
                x: 0,
                y: 807,
                sizex: 2000,
                sizey: 807,
                sizing: "stretch",
                opacity: 0.9,
                layer: "below"
            }],
            dragmode: false
        };
        
        // Initial empty plot
        Plotly.newPlot(plotDiv, [], rinkLayout, { 
            responsive: true,
            displayModeBar: false,
            staticPlot: false
        });
        
        // Force resize after a brief delay to ensure proper rendering
        setTimeout(() => {
            if (plotDiv) {
                console.log('Forcing Plotly resize');
                Plotly.Plots.resize(plotDiv);
            }
        }, 100);
        
        this.updateVisualization();
    }
    
    scaleXCoordinate(x) {
        // Scale hockey rink coordinates (0-200 feet) to image pixel coordinates (0-2000)
        if (x === null || x === undefined) return 0;
        // Direct scaling without excessive margins
        const clampedX = Math.max(0, Math.min(200, x));
        return (clampedX / 200) * 2000;
    }
    
    scaleYCoordinate(y) {
        // Scale hockey rink coordinates (0-85 feet) to image pixel coordinates (0-807)
        // Note: Y coordinates are flipped in the image (0 at top, 807 at bottom)
        if (y === null || y === undefined) return 0;
        // Direct scaling to match actual image dimensions
        const clampedY = Math.max(0, Math.min(85, y));
        return 807 - ((clampedY / 85) * 807);
    }
    
    updateVisualization() {
        const plotDiv = document.getElementById('plot');
        
        // Filter shots by time if needed
        let shotsToShow = this.filteredShots;
        
        if (this.currentTimeFilter > 0) {
            // Use dynamic max time based on selected periods
            const dynamicMaxTime = this.getMaxTimeForSelectedPeriods();
            const maxTime = this.timeRange.min + (dynamicMaxTime - this.timeRange.min) * (this.currentTimeFilter / 100);
            shotsToShow = this.filteredShots.filter(shot => 
                shot.time_seconds <= maxTime
            );
        }
        
        // Add slight jitter to overlapping shots to prevent hover conflicts
        const coordinateTracker = new Map();
        const jitteredShots = shotsToShow.map(shot => {
            const coordKey = `${shot.x_coordinate},${shot.y_coordinate}`;
            let jitterCount = coordinateTracker.get(coordKey) || 0;
            coordinateTracker.set(coordKey, jitterCount + 1);
            
            // Add small random offset for overlapping shots, constrained to stay within rink
            const maxJitterX = Math.min(1, 200 - shot.x_coordinate, shot.x_coordinate);
            const maxJitterY = Math.min(1, 85 - shot.y_coordinate, shot.y_coordinate);
            
            const jitterX = jitterCount > 0 ? (Math.random() - 0.5) * maxJitterX : 0;
            const jitterY = jitterCount > 0 ? (Math.random() - 0.5) * maxJitterY : 0;
            
            return {
                ...shot,
                display_x: Math.max(0, Math.min(200, shot.x_coordinate + jitterX)),
                display_y: Math.max(0, Math.min(85, shot.y_coordinate + jitterY))
            };
        });
        
        // Create traces based on current shot view mode
        const traces = this.createShotTraces(jitteredShots);
        
        const layout = {
            title: '',
            showlegend: false, // Always false - using custom legend
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: '#f8fafc',
            margin: { l: 20, r: 20, t: 20, b: 20 },
            xaxis: {
                range: [0, 2000],
                showgrid: false,
                showticklabels: false,
                zeroline: false,
                fixedrange: true
            },
            yaxis: {
                range: [0, 807],
                showgrid: false,
                showticklabels: false,
                zeroline: false,
                fixedrange: true,
                scaleanchor: 'x',
                scaleratio: 1
            },
            images: [{
                source: "/static/rink.png",
                xref: "x",
                yref: "y", 
                x: 0,
                y: 807,
                sizex: 2000,
                sizey: 807,
                sizing: "stretch",
                opacity: 0.9,
                layer: "below"
            }],
            hovermode: 'closest',
            dragmode: false
        };
        
        Plotly.react(plotDiv, traces, layout, { 
            responsive: true,
            displayModeBar: false
        });
        
        // Update the custom analysis legend
        this.updateAnalysisLegend();
    }
    
    createShotTraces(shots) {
        const traces = [];
        
        switch (this.currentShotView) {
            case 'for-against':
                return this.createForAgainstTraces(shots);
            case 'zones':
                return this.createZoneTraces(shots);
            case 'types':
                return this.createTypeTraces(shots);
            case 'outcomes':
                return this.createOutcomeTraces(shots);
            case 'heat-map':
                return this.createHeatMapTraces(shots);
            default:
                return this.createForAgainstTraces(shots);
        }
    }
    
    createForAgainstTraces(shots) {
        const teamGroups = {};
        shots.forEach(shot => {
            const team = shot.team_display;
            if (!teamGroups[team]) teamGroups[team] = [];
            teamGroups[team].push(shot);
        });
        
        const traces = [];
        Object.entries(teamGroups).forEach(([team, teamShots]) => {
            if (teamShots.length === 0) return;
            
            traces.push({
                x: teamShots.map(s => this.scaleXCoordinate(s.display_x)),
                y: teamShots.map(s => this.scaleYCoordinate(s.display_y)),
                mode: 'markers',
                type: 'scatter',
                name: team,
                marker: {
                    size: teamShots.map(s => s.event === 'Goal' ? 16 : 12),
                    color: this.teamColors[team] || '#6B7280',
                    symbol: teamShots.map(s => s.event === 'Goal' ? 'star' : 'circle'),
                    opacity: 0.8,
                    line: { width: 2, color: '#fff' }
                },
                text: teamShots.map(s => this.generateShotTooltip(s)),
                hovertemplate: '%{text}<extra></extra>',
                hoverlabel: {
                    bgcolor: this.teamColors[team] || '#6B7280',
                    bordercolor: '#ffffff',
                    borderwidth: 1,
                    font: { color: '#ffffff', size: 12, family: 'Inter, sans-serif' },
                    align: 'left',
                    namelength: 0
                }
            });
        });
        
        return traces;
    }
    
    createZoneTraces(shots) {
        const zoneGroups = {};
        shots.forEach(shot => {
            const zone = shot.shotZone;
            if (!zoneGroups[zone]) zoneGroups[zone] = [];
            zoneGroups[zone].push(shot);
        });
        
        const traces = [];
        Object.entries(zoneGroups).forEach(([zone, zoneShots]) => {
            if (zoneShots.length === 0) return;
            
            const zoneInfo = this.shotZones[zone];
            traces.push({
                x: zoneShots.map(s => this.scaleXCoordinate(s.display_x)),
                y: zoneShots.map(s => this.scaleYCoordinate(s.display_y)),
                mode: 'markers',
                type: 'scatter',
                name: zoneInfo.name,
                marker: {
                    size: zoneShots.map(s => s.event === 'Goal' ? 16 : 12),
                    color: zoneInfo.color,
                    symbol: zoneShots.map(s => s.event === 'Goal' ? 'star' : 'circle'),
                    opacity: 0.8,
                    line: { width: 2, color: '#fff' }
                },
                text: zoneShots.map(s => this.generateShotTooltip(s)),
                hovertemplate: '%{text}<extra></extra>'
            });
        });
        
        return traces;
    }
    
    createTypeTraces(shots) {
        const typeGroups = {};
        shots.forEach(shot => {
            const type = shot.detail_1 || 'Unknown';
            if (!typeGroups[type]) typeGroups[type] = [];
            typeGroups[type].push(shot);
        });
        
        const traces = [];
        Object.entries(typeGroups).forEach(([type, typeShots]) => {
            if (typeShots.length === 0) return;
            
            const color = this.shotTypeColors[type] || '#6B7280';
            traces.push({
                x: typeShots.map(s => this.scaleXCoordinate(s.display_x)),
                y: typeShots.map(s => this.scaleYCoordinate(s.display_y)),
                mode: 'markers',
                type: 'scatter',
                name: type,
                marker: {
                    size: typeShots.map(s => s.event === 'Goal' ? 16 : 12),
                    color: color,
                    symbol: typeShots.map(s => s.event === 'Goal' ? 'star' : 'circle'),
                    opacity: 0.8,
                    line: { width: 2, color: '#fff' }
                },
                text: typeShots.map(s => this.generateShotTooltip(s)),
                hovertemplate: '%{text}<extra></extra>'
            });
        });
        
        return traces;
    }
    
    createOutcomeTraces(shots) {
        const outcomeGroups = {};
        shots.forEach(shot => {
            const outcome = shot.shotOutcome;
            if (!outcomeGroups[outcome]) outcomeGroups[outcome] = [];
            outcomeGroups[outcome].push(shot);
        });
        
        const traces = [];
        Object.entries(outcomeGroups).forEach(([outcome, outcomeShots]) => {
            if (outcomeShots.length === 0) return;
            
            const color = this.shotOutcomeColors[outcome] || '#6B7280';
            traces.push({
                x: outcomeShots.map(s => this.scaleXCoordinate(s.display_x)),
                y: outcomeShots.map(s => this.scaleYCoordinate(s.display_y)),
                mode: 'markers',
                type: 'scatter',
                name: outcome,
                marker: {
                    size: outcomeShots.map(s => s.event === 'Goal' ? 16 : 12),
                    color: color,
                    symbol: outcomeShots.map(s => s.event === 'Goal' ? 'star' : 'circle'),
                    opacity: 0.8,
                    line: { width: 2, color: '#fff' }
                },
                text: outcomeShots.map(s => this.generateShotTooltip(s)),
                hovertemplate: '%{text}<extra></extra>'
            });
        });
        
        return traces;
    }
    
    createHeatMapTraces(shots) {
        // Grid dimensions for heat map
        const gridWidth = 25;  // Number of cells horizontally
        const gridHeight = 15; // Number of cells vertically
        
        // Create 2D array for shot counts
        const heatData = Array(gridHeight).fill().map(() => Array(gridWidth).fill(0));
        
        // Count shots in each grid cell
        shots.forEach(shot => {
            // Convert coordinates to grid indices
            const gridX = Math.floor((shot.display_x / 200) * gridWidth);
            const gridY = Math.floor((shot.display_y / 85) * gridHeight);
            
            // Ensure within bounds
            if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
                heatData[gridY][gridX]++;
            }
        });
        
        // Create X and Y coordinates for grid centers (in image pixel coordinates)
        const xCoords = Array(gridWidth).fill().map((_, i) => 
            ((i + 0.5) / gridWidth) * 2000  // Center of each grid cell in pixels
        );
        const yCoords = Array(gridHeight).fill().map((_, i) => 
            ((i + 0.5) / gridHeight) * 807  // Center of each grid cell in pixels  
        );
        
        // Create heat map trace
        const heatTrace = {
            z: heatData,
            x: xCoords,
            y: yCoords,
            type: 'heatmap',
            colorscale: [
                [0, 'rgba(0,0,0,0)'],      // Transparent for zero shots
                [0.1, 'rgba(0,0,255,0.3)'], // Blue for low density
                [0.3, 'rgba(0,255,0,0.5)'], // Green for medium density
                [0.6, 'rgba(255,255,0,0.7)'], // Yellow for high density
                [1, 'rgba(255,0,0,0.9)']   // Red for highest density
            ],
            showscale: true,
            colorbar: {
                title: 'Shot Density',
                titleside: 'right',
                thickness: 20,
                len: 0.7,
                x: 1.02
            },
            hovertemplate: 'Shot Density: %{z}<br>Grid Cell: %{x:.0f}, %{y:.0f}<extra></extra>',
            zsmooth: 'best' // Smooth the heat map for better visual appeal
        };
        
        return [heatTrace];
    }
    
    generateShotTooltip(shot) {
        let tooltip = `<b style="font-size: 14px;">${shot.player}</b><br>`;
        tooltip += `<span style="color: rgba(255,255,255,0.9);">${shot.event}</span><br>`;
        
        // Shot-specific details
        if (shot.detail_1) {
            tooltip += `<span style="color: rgba(255,255,255,0.8);">${shot.detail_1}</span><br>`;
        }
        
        tooltip += `<span style="color: rgba(255,255,255,0.7);">${shot.shotOutcome}</span><br>`;
        
        // Zone information
        const zoneInfo = this.shotZones[shot.shotZone];
        if (zoneInfo) {
            tooltip += `<span style="color: rgba(255,255,255,0.6);">${zoneInfo.name} Zone</span><br>`;
        }
        
        // Traffic and one-timer info
        if (shot.detail_3 === 'true') {
            tooltip += `<span style="color: rgba(255,255,255,0.6);">Through Traffic</span><br>`;
        }
        if (shot.detail_4 === 'true') {
            tooltip += `<span style="color: rgba(255,255,255,0.6);">One Timer</span><br>`;
        }
        
        tooltip += `<span style="color: rgba(255,255,255,0.8);">Period ${shot.period} • ${shot.clock}</span>`;
        
        return tooltip;
    }
    
    updateAnalysisLegend() {
        const legendContainer = document.getElementById('legend-items');
        const analysisLegend = document.getElementById('analysis-legend');
        
        // Clear existing legend items
        legendContainer.innerHTML = '';
        
        let legendData = [];
        
        switch (this.currentShotView) {
            case 'types':
                // Show shot types legend
                Object.entries(this.shotTypeColors).forEach(([type, color]) => {
                    legendData.push({
                        label: type,
                        color: color,
                        marker: 'circle'
                    });
                });
                break;
                
            case 'zones':
                // Show shot zones legend
                Object.entries(this.shotZones).forEach(([key, zone]) => {
                    legendData.push({
                        label: zone.name,
                        color: zone.color,
                        marker: 'circle'
                    });
                });
                break;
                
            case 'outcomes':
                // Show shot outcomes legend
                Object.entries(this.shotOutcomeColors).forEach(([outcome, color]) => {
                    legendData.push({
                        label: outcome,
                        color: color,
                        marker: outcome === 'Goal' ? 'star' : 'circle'
                    });
                });
                break;
                
            case 'heat-map':
                // No legend for heat map - uses color bar instead
                analysisLegend.classList.remove('visible');
                return;
                
            case 'for-against':
            default:
                // No legend for for-against view
                analysisLegend.classList.remove('visible');
                return;
        }
        
        // Create legend items
        legendData.forEach(item => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            
            const marker = document.createElement('div');
            marker.className = `legend-marker ${item.marker === 'star' ? 'star' : ''}`;
            marker.style.backgroundColor = item.color;
            
            const label = document.createElement('span');
            label.className = 'legend-label';
            label.textContent = item.label;
            
            legendItem.appendChild(marker);
            legendItem.appendChild(label);
            legendContainer.appendChild(legendItem);
        });
        
        // Show legend with animation
        analysisLegend.classList.add('visible');
    }

    
    resizePlot() {
        const plotDiv = document.getElementById('plot');
        if (plotDiv) {
            Plotly.Plots.resize(plotDiv);
        }
    }
    
    hideLoading() {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
    
    showError(message) {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.innerHTML = `
                <div class="loading-spinner" style="border-top-color: #EF4444;"></div>
                <span class="loading-text" style="color: #EF4444;">${message}</span>
            `;
        }
        console.error('Visualizer Error:', message);
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

// Initialize the visualizer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new HockeyVisualizer();
});


