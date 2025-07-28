
from flask import Flask, render_template, send_from_directory, jsonify
import pandas as pd
import os

app = Flask(__name__, template_folder='../frontend/templates', static_folder='../frontend/static')
DATA_PATH = os.path.join(os.path.dirname(__file__), '../data/sample.csv')

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/events")
def events():
    df = pd.read_csv(DATA_PATH)
    return jsonify(df.to_dict(orient="records"))

if __name__ == "__main__":
    app.run(debug=True)
