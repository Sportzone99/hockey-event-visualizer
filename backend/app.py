
from flask import Flask, render_template, send_from_directory, jsonify, request
import pandas as pd
import os
import numpy as np

app = Flask(__name__, template_folder='../frontend/templates', static_folder='../frontend/static')

# Helper functions to clean data for JSON serialization
def clean_value(value):
    """Clean string values, converting NaN to empty string"""
    if pd.isna(value) or value is None or value == np.nan:
        return ''
    return str(value)

def clean_numeric_value(value):
    """Clean numeric values, converting NaN to None (null in JSON)"""
    if pd.isna(value) or value is None or value == np.nan:
        return None
    return float(value)

# Use Olympic Women's Hockey dataset
DATA_PATH = os.path.join(os.path.dirname(__file__), '../data/olympic_womens_dataset.csv')

# Cache the dataset for better performance
_dataset_cache = None

def clear_dataset_cache():
    """Clear the dataset cache to force reload with new game_id format"""
    global _dataset_cache
    _dataset_cache = None

def load_dataset():
    """Load and cache the dataset"""
    global _dataset_cache
    if _dataset_cache is None:
        _dataset_cache = pd.read_csv(DATA_PATH)
        
        # Filter to only Olympic (Women) games
        olympic_mask = (_dataset_cache['Home Team'].str.contains('Olympic \\(Women\\)', na=False) & 
                       _dataset_cache['Away Team'].str.contains('Olympic \\(Women\\)', na=False))
        _dataset_cache = _dataset_cache[olympic_mask]
        
        # Clean and prepare the data
        _dataset_cache = _dataset_cache.dropna(subset=['X Coordinate', 'Y Coordinate'])
        # Ensure numeric coordinates
        _dataset_cache['X Coordinate'] = pd.to_numeric(_dataset_cache['X Coordinate'], errors='coerce')
        _dataset_cache['Y Coordinate'] = pd.to_numeric(_dataset_cache['Y Coordinate'], errors='coerce')
        # Convert time to numeric for filtering (convert MM:SS to total seconds)
        _dataset_cache['time_seconds'] = _dataset_cache['Clock'].apply(parse_time_to_seconds)
        # Add team colors
        _dataset_cache['team_color'] = _dataset_cache['Team'].apply(get_team_color)
        # Simplify team names for display
        _dataset_cache['team_display'] = _dataset_cache['Team'].apply(simplify_team_name)
        # Add team logos
        _dataset_cache['team_logo'] = _dataset_cache['Team'].apply(get_team_logo)
        # Add game identifier (include date to make it unique)
        _dataset_cache['game_id'] = _dataset_cache['game_date'] + ' - ' + _dataset_cache['Home Team'] + ' vs ' + _dataset_cache['Away Team']
    return _dataset_cache

def parse_time_to_seconds(time_str):
    """Convert MM:SS time format to total seconds from start of period"""
    try:
        if pd.isna(time_str):
            return 0
        parts = str(time_str).split(':')
        if len(parts) == 2:
            minutes, seconds = parts
            # Hockey clock counts down, so convert to time elapsed
            total_seconds = (20 * 60) - (int(minutes) * 60 + int(seconds))
            return max(0, total_seconds)
        return 0
    except:
        return 0

def get_team_color(team_name):
    """Get team color based on team name"""
    if 'Canada' in str(team_name):
        return '#DC2626'  # Red for Canada
    elif 'United States' in str(team_name):
        return '#1D4ED8'  # Blue for United States
    elif 'Finland' in str(team_name):
        return '#87CEEB'  # Light Blue
    elif 'Russia' in str(team_name) or 'Olympic Athletes from Russia' in str(team_name):
        return '#FFD700'  # Yellow
    else:
        return '#6B7280'  # Gray for other teams

def simplify_team_name(team_name):
    """Simplify team names for display"""
    if 'Canada' in str(team_name):
        return 'Canada'
    elif 'United States' in str(team_name):
        return 'United States'
    elif 'Finland' in str(team_name):
        return 'Finland'
    elif 'Russia' in str(team_name) or 'Olympic Athletes from Russia' in str(team_name):
        return 'Olympic Athletes from Russia'
    else:
        return str(team_name)

def get_team_logo(team_name):
    """Get team logo URL"""
    simplified = simplify_team_name(team_name)
    if simplified == 'United States':
        return 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/USA_hockey_logo.gif/500px-USA_hockey_logo.gif'
    elif simplified == 'Canada':
        return 'https://assets.leaguestat.com/hockeycanada/logos/355.png'
    elif simplified == 'Finland':
        return 'https://assets.leaguestat.com/hockeycanada/logos/363.png'
    elif simplified == 'Olympic Athletes from Russia':
        return 'https://assets.leaguestat.com/hockeycanada/logos/670.png'
    else:
        return None

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/faceoffs")
def faceoffs():
    return render_template("faceoffs.html")

@app.route("/api/clear-cache")
def clear_cache():
    """Clear the dataset cache"""
    clear_dataset_cache()
    return jsonify({"message": "Cache cleared successfully"})

@app.route("/api/games")
def games():
    """Get available Olympic games"""
    df = load_dataset()
    
    # Get unique games
    games_data = df[['game_date', 'Home Team', 'Away Team', 'game_id']].drop_duplicates()
    
    games_list = []
    for _, row in games_data.iterrows():
        home_team = simplify_team_name(row['Home Team'])
        away_team = simplify_team_name(row['Away Team'])
        
        games_list.append({
            'id': clean_value(row['game_id']),
            'date': clean_value(row['game_date']),
            'home_team': home_team,
            'away_team': away_team,
            'home_logo': get_team_logo(row['Home Team']),
            'away_logo': get_team_logo(row['Away Team']),
            'display_name': f"{home_team} vs {away_team}"
        })
    
    # Sort by date
    games_list.sort(key=lambda x: x['date'])
    
    return jsonify(games_list)

@app.route("/api/events")
def events():
    """Get filtered hockey events"""
    df = load_dataset()
    
    # Get filter parameters
    game_filter = request.args.get('game', 'all')
    team_filter = request.args.get('team', 'all')
    event_filter = request.args.get('event', 'all')
    period_filter = request.args.get('period', 'all')
    player_filter = request.args.get('player', '').lower()
    
    # Apply filters
    filtered_df = df.copy()
    
    if game_filter != 'all':
        filtered_df = filtered_df[filtered_df['game_id'] == game_filter]
    
    if team_filter != 'all':
        filtered_df = filtered_df[filtered_df['team_display'] == team_filter]
    
    if event_filter != 'all':
        filtered_df = filtered_df[filtered_df['Event'] == event_filter]
    
    if period_filter != 'all':
        filtered_df = filtered_df[filtered_df['Period'] == int(period_filter)]
    
    if player_filter:
        filtered_df = filtered_df[filtered_df['Player'].str.lower().str.contains(player_filter, na=False)]
    
    # Convert to records and add enhanced data
    events_data = []
    for _, row in filtered_df.iterrows():
        event_data = {
            'game_date': clean_value(row['game_date']),
            'home_team': clean_value(row.get('Home Team', '')),
            'away_team': clean_value(row.get('Away Team', '')),
            'period': int(row['Period']) if pd.notna(row['Period']) else 1,
            'clock': clean_value(row['Clock']),
            'time_seconds': clean_numeric_value(row['time_seconds']),
            'team': clean_value(row['Team']),
            'team_display': clean_value(row['team_display']),
            'team_color': clean_value(row['team_color']),
            'player': clean_value(row['Player']),
            'event': clean_value(row['Event']),
            'x_coordinate': clean_numeric_value(row['X Coordinate']),
            'y_coordinate': clean_numeric_value(row['Y Coordinate']),
            'detail_1': clean_value(row.get('Detail 1', '')),
            'detail_2': clean_value(row.get('Detail 2', '')),
            'detail_3': clean_value(row.get('Detail 3', '')),
            'detail_4': clean_value(row.get('Detail 4', '')),
            'player_2': clean_value(row.get('Player 2', '')),
            'home_team_skaters': clean_numeric_value(row.get('Home Team Skaters')),
            'away_team_skaters': clean_numeric_value(row.get('Away Team Skaters'))
        }
        events_data.append(event_data)
    
    return jsonify(events_data)

@app.route("/api/teams")
def teams():
    """Get available teams for selected game"""
    df = load_dataset()
    
    # Get game filter if provided
    game_filter = request.args.get('game', 'all')
    
    if game_filter != 'all':
        # Filter to specific game
        filtered_df = df[df['game_id'] == game_filter]
        teams_data = filtered_df['team_display'].unique().tolist()
    else:
        # Return all teams
        teams_data = df['team_display'].unique().tolist()
    
    # Clean and sort teams
    teams_data = [team for team in teams_data if pd.notna(team)]
    teams_data.sort()
    
    return jsonify(teams_data)

@app.route("/api/events/types")
def event_types():
    """Get available event types"""
    df = load_dataset()
    events = df['Event'].unique().tolist()
    events = [event for event in events if pd.notna(event)]
    return jsonify(sorted(events))

@app.route("/api/players")
def players():
    """Get available players"""
    df = load_dataset()
    players = df['Player'].unique().tolist()
    players = [player for player in players if pd.notna(player)]
    return jsonify(sorted(players))

@app.route("/api/stats")
def stats():
    """Get dataset statistics"""
    df = load_dataset()
    
    # Calculate statistics
    total_events = int(len(df))
    unique_players = int(df['Player'].nunique())
    unique_events = int(df['Event'].nunique())
    unique_teams = int(df['team_display'].nunique())
    
    # Most active player
    player_counts = df['Player'].value_counts()
    most_active_player = player_counts.index[0] if len(player_counts) > 0 else "N/A"
    most_active_count = int(player_counts.iloc[0]) if len(player_counts) > 0 else 0
    
    # Event type breakdown
    event_breakdown = df['Event'].value_counts().head(10).to_dict()
    
    # Team breakdown
    team_breakdown = df['team_display'].value_counts().to_dict()
    
    # Period breakdown
    period_breakdown = df['Period'].value_counts().to_dict()
    
    return jsonify({
        'total_events': total_events,
        'unique_players': unique_players,
        'unique_events': unique_events,
        'unique_teams': unique_teams,
        'most_active_player': {
            'name': most_active_player,
            'count': most_active_count
        },
        'event_breakdown': {k: int(v) for k, v in event_breakdown.items()},
        'team_breakdown': {k: int(v) for k, v in team_breakdown.items()},
        'period_breakdown': {k: int(v) for k, v in period_breakdown.items()}
    })

@app.route("/api/time-range")
def time_range():
    """Get the time range of the dataset"""
    df = load_dataset()
    min_time = df['time_seconds'].min()
    max_time = df['time_seconds'].max()
    
    return jsonify({
        'min_seconds': int(min_time) if pd.notna(min_time) else 0,
        'max_seconds': int(max_time) if pd.notna(max_time) else 1200,
        'min_time': seconds_to_time_string(min_time),
        'max_time': seconds_to_time_string(max_time)
    })

def seconds_to_time_string(seconds):
    """Convert seconds to MM:SS format"""
    if pd.isna(seconds):
        return "00:00"
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes:02d}:{secs:02d}"

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(debug=False, host="0.0.0.0", port=port)
