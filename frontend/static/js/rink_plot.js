
fetch('/api/events')
  .then(res => res.json())
  .then(data => {
    const trace = {
      x: data.map(d => d['X Coordinate'] * 10),
      y: data.map(d => 857 - d['Y Coordinate'] * 10.08),  // Flip Y to match image
      text: data.map(d => d['Player'] + ' - ' + d['Event']),
      mode: 'markers',
      type: 'scatter',
      marker: { size: 6, color: 'red' },
      hoverinfo: 'text'
    };

    const layout = {
      margin: { t: 0, l: 0, r: 0, b: 0 },
      xaxis: { visible: false, range: [0, 2000] },
      yaxis: { visible: false, range: [0, 857] },
      images: [{
        source: "/static/rink.png",
        xref: "x",
        yref: "y",
        x: 0,
        y: 857,
        sizex: 2000,
        sizey: 857,
        sizing: "stretch",
        opacity: 1,
        layer: "below"
      }]
    };

    Plotly.newPlot('plot', [trace], layout, { staticPlot: true });
  });
