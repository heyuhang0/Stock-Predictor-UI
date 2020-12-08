import os
import csv
import requests
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask, jsonify
from bs4 import BeautifulSoup
import numpy as np

app = Flask(__name__)

base_dir = Path(__file__).absolute().parent
load_dotenv(dotenv_path=base_dir/'.env')
MARKET_STACK_API_KEY = os.getenv("MARKET_STACK_API_KEY")

symbols = {}
with open(base_dir/'SP500list.csv', newline='') as f:
    reader = csv.reader(f)
    for row in reader:
        symbols[row[0]] = {
            'name': row[1],
            'sector': row[2]
        }
    del symbols['Symbol']


@app.route('/api/symbols')
def get_symbols():
    return jsonify({
        'symbols': symbols
    })


def get_news_titles(symbol):
    response = requests.get(
        'https://www.marketwatch.com/investing/stock/{}'.format(symbol.lower()),
        headers={
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.67 Safari/537.36 Edg/87.0.664.55',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'sec-fetch-site': 'none',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-user': '?1',
            'sec-fetch-dest': 'document',
            'accept-language': 'zh-CN,zh;q=0.9,en-GB;q=0.8,en-US;q=0.7,en;q=0.6',
        })
    soup = BeautifulSoup(response.text, 'html.parser')
    titles = []
    for article_div in soup.find_all('div', {'class': 'element element--article'}):
        title = article_div.find('h3', {'class': 'article__headline'}).a.text.strip()
        if title and len(title) > 10:
            titles.append(title)
    return titles


embed = None
model = None


def do_prediction(titles, price_open, price_high, price_low, price_close):
    global embed
    global model
    if embed is None:
        import tensorflow_hub as hub
        from keras.models import Sequential
        from keras.layers import Dense
        embed = hub.load("https://tfhub.dev/google/universal-sentence-encoder/4")
        model = Sequential()
        model.add(Dense(128, input_shape=(515,)))
        model.add(Dense(64))
        model.add(Dense(1, activation='sigmoid'))
        model.load_weights(str(base_dir/'use_dense_t1.h5'))

    title = ';'.join(titles[:5])
    rel_high = price_high / price_open - 1
    rel_low = price_low / price_open - 1
    rel_close = price_close / price_open - 1

    inputs = np.zeros((1, 515))
    inputs[:, :512] = embed([title])
    inputs[0][512] = rel_high
    inputs[0][513] = rel_low
    inputs[0][514] = rel_close

    return float(model.predict(inputs)[0][0])


@app.route('/api/symbols/<symbol>')
def get_data(symbol):
    if symbol not in symbols:
        return (jsonify({
            'message': 'symbol not found'
        }), 404)

    # Get news
    titles = get_news_titles(symbol)

    # Get price values
    prices_response = requests.get('http://api.marketstack.com/v1/eod', {
        'access_key': MARKET_STACK_API_KEY,
        'symbols': symbol
    })
    prices = prices_response.json()['data']
    last_day_price = prices[0]
    print(last_day_price)

    # Do prediction
    prediction = do_prediction(
        titles,
        last_day_price['open'],
        last_day_price['high'],
        last_day_price['low'],
        last_day_price['close'])

    return jsonify({
        'name': symbols[symbol]['name'],
        'news': titles,
        'prices': prices,
        'prediction': prediction
    })


if __name__ == "__main__":
    app.run()
