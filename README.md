# Hockey Event Visualizer

A web application for visualizing hockey game events with interactive rink diagrams, faceoff analysis, and detailed statistics. Built with Flask, Plotly, and modern web technologies.

## Features

### Main Dashboard
- Interactive rink visualization with real-time event plotting
- Game selection from multiple Olympic women's hockey games
- Event filtering by team, player, event type, period, and time range
- Statistics dashboard with real-time game statistics and event breakdowns
- Team colors and logos for visual team identification

### Faceoffs Analysis
- Dedicated faceoff analysis page
- Visual representation of faceoff positions on the rink
- Faceoff success rate tracking by team and player
- Time-based analysis of faceoff patterns throughout the game

### Data Features
- Olympic women's hockey dataset from 2018 Olympics
- Support for multiple games including Canada vs Russia and Canada vs Finland
- RESTful API endpoints for data access
- Optimized performance with dataset caching

## Local Deployment Instructions

### Prerequisites
- Python 3.9 or higher
- pip (Python package installer)

### Step-by-Step Local Setup

1. Clone the repository
   ```bash
   git clone https://github.com/Sportzone99/hockey-event-visualizer.git
   cd hockey-event-visualizer
   ```

2. Create and activate virtual environment
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies
   ```bash
   pip install -r requirements.txt
   ```

4. Run the application
   ```bash
   python backend/app.py
   ```

5. Open your browser and navigate to `http://localhost:5001`

### Troubleshooting
- If you get a port conflict, the app will automatically try the next available port
- Make sure your virtual environment is activated before installing dependencies
- On Windows, use `venv\Scripts\activate` instead of `source venv/bin/activate`

## Usage Guide

### Main Dashboard
1. Select a game from the dropdown menu of available Olympic games
2. Use the filter panel to narrow down events by:
   - Team (Canada, United States, Finland, Russia)
   - Player name
   - Event type (Goal, Shot, Faceoff, etc.)
   - Period (1, 2, 3)
   - Time range using the slider
3. Events appear as colored dots on the rink diagram
4. Click on events to see detailed information

### Faceoffs Page
1. Click the "Faceoffs" link in the navigation
2. Choose the game you want to analyze
3. View all faceoffs plotted on the rink
4. Use filters to focus on specific teams or players
5. Observe faceoff distribution and success rates

### API Endpoints
The application provides several REST API endpoints:

- `GET /api/games` - List all available games
- `GET /api/events` - Get filtered events data
- `GET /api/teams` - Get teams for selected game
- `GET /api/players` - Get all players
- `GET /api/events/types` - Get available event types
- `GET /api/stats` - Get dataset statistics
- `GET /api/time-range` - Get time range information

## Project Structure

```
hockey-event-visualizer/
├── backend/
│   └── app.py                 # Flask application and API endpoints
├── data/
│   ├── olympic_womens_dataset.csv  # Main Olympic dataset
│   ├── olympic_sample_200.csv      # Sample data
│   ├── sample_1000.csv             # Additional sample data
│   └── usa_canada_game.csv         # USA vs Canada game data
├── frontend/
│   ├── static/
│   │   ├── css/
│   │   │   └── styles.css          # Main stylesheet
│   │   ├── js/
│   │   │   ├── rink_plot.js        # Main rink visualization
│   │   │   └── faceoffs.js         # Faceoffs page functionality
│   │   └── rink.png                # Hockey rink background image
│   └── templates/
│       ├── index.html              # Main dashboard
│       └── faceoffs.html           # Faceoffs analysis page
├── requirements.txt                # Python dependencies
└── README.md                       # This file
```

## Technology Stack

- Backend: Flask (Python web framework)
- Frontend: HTML5, CSS3, JavaScript (ES6+)
- Visualization: Plotly.js for interactive charts
- Data Processing: Pandas for data manipulation
- Styling: Custom CSS with modern design principles
- Icons: Font Awesome for UI icons

## Data Sources

The application uses Olympic women's hockey data from the 2018 Winter Olympics, including:
- Canada vs Olympic Athletes from Russia
- Canada vs Finland
- Additional Olympic women's hockey games

Each dataset includes:
- Event coordinates (X, Y positions on rink)
- Game timing (period, clock)
- Player information
- Event types and details
- Team statistics

## Development

### Adding New Data
1. Place CSV files in the `data/` directory
2. Ensure columns match the expected format:
   - `X Coordinate`, `Y Coordinate` for positioning
   - `Team`, `Player` for identification
   - `Event`, `Period`, `Clock` for event details
   - `Home Team`, `Away Team`, `game_date` for game info

### Extending Features
- Add new event types to the filtering system
- Create new JavaScript modules for additional visualizations
- Extend the Flask backend with new API routes

### Styling
- Main styles are in `frontend/static/css/styles.css`
- Uses CSS Grid and Flexbox for responsive design
- Color scheme optimized for hockey rink visualization

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the MIT License.

## Acknowledgments

- Olympic hockey data sources
- Plotly.js for visualization capabilities
- Font Awesome for icons
- The hockey community for inspiration

## Support

If you encounter any issues or have questions:
1. Check the Issues page on GitHub
2. Create a new issue with detailed information
3. Include steps to reproduce the problem

---

Happy Hockey Analysis!