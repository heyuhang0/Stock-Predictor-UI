import React from 'react';
import { Row, Col, Card, Select, Timeline } from 'antd';
import { CaretUpOutlined, CaretDownOutlined } from '@ant-design/icons';
import ReactEcharts from 'echarts-for-react';
import axios from 'axios';
import './App.css';

const { Option } = Select;

const upColor = '#00da3c';
const upBorderColor = '#008F28';
const downColor = '#ec0000';
const downBorderColor = '#8A0000';


export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loadingSymbols: true,
      symbols: {},
      loadingData: true,
      chartOption: null,
      news: [],
      prediction: 0.5,
    };
  }

  componentDidMount() {
    axios.get('/api/symbols')
      .then(res => {
        this.setState({
          loadingSymbols: false,
          symbols: res.data.symbols,
        });
        this.updateData('AAPL');
      })
  }

  getOption = (title, data0) => {
    return {
      title: {
        text: title,
        left: 0
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        }
      },
      xAxis: {
        type: 'category',
        data: data0.categoryData,
        scale: true,
        boundaryGap: false,
        axisLine: { onZero: false },
        splitLine: { show: false },
        splitNumber: 20,
        min: 'dataMin',
        max: 'dataMax'
      },
      yAxis: {
        scale: true,
        splitArea: {
          show: true
        }
      },
      dataZoom: [
        {
          type: 'inside',
          start: 50,
          end: 100
        },
        {
          show: true,
          type: 'slider',
          top: '90%',
          start: 50,
          end: 100
        }
      ],
      series: [
        {
          type: 'candlestick',
          data: data0.values,
          itemStyle: {
            color: upColor,
            color0: downColor,
            borderColor: upBorderColor,
            borderColor0: downBorderColor
          }
        },
      ]
    };
  };

  updateData = (newSymbol) => {
    this.setState({ loadingData: true });
    axios.get(`/api/symbols/${newSymbol}`)
      .then(res => {
        let prices = res.data.prices;
        let data = {
          categoryData: [],
          values: []
        }
        for (var i = prices.length - 1; i > -1; i--) {
          data.categoryData.push(prices[i].date.slice(0, 10));
          data.values.push([
            prices[i].adj_open,
            prices[i].adj_close,
            prices[i].adj_low,
            prices[i].adj_high,
          ]);
        }
        let title = `${res.data.name} (${newSymbol})`;

        this.setState({
          news: res.data.news,
          prediction: res.data.prediction,
          loadingData: false,
          chartOption: this.getOption(title, data),
        });
      })
  }

  render() {
    return (
      <div className="App">
        <div className="content">
          <Row>
            <Col span={24}>
              <div className="search-box">
                <Select
                  showSearch
                  style={{ width: '100%' }}
                  placeholder="Select a symbol"
                  onSelect={this.updateData}
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {Object.keys(this.state.symbols).map((symbol) => {
                    return (
                      <Option key={symbol}>
                        {`${this.state.symbols[symbol].name} (${symbol})`}
                      </Option>)
                  })}
                </Select>
              </div>
            </Col>
          </Row>
          <Row>
            <Col span={18}>
              <Card title={null} loading={this.state.loadingData}>
                {
                  this.state.chartOption ? (
                    <ReactEcharts
                      option={this.state.chartOption}
                      style={{ height: '408px', width: '100%' }}
                      className='react_for_echarts'
                      notMerge={true}
                      lazyUpdate={true}
                    />
                  ) : null
                }
              </Card>
            </Col>
            <Col span={6}>
              <Card title="Prediction" loading={this.state.loadingData}>
                <div style={{
                  color: this.state.prediction > 0.5 ? upColor : downColor,
                  height: '350px',
                  paddingTop: '40px'
                }}>
                  <div style={{ textAlign: "center", fontSize: 50 }}>
                    {Math.round((Math.max(this.state.prediction, 1 - this.state.prediction) * 100))}%
                  </div>
                  <div style={{ textAlign: "center", fontSize: 80 }}>
                    {this.state.prediction > 0.5 ? <CaretUpOutlined /> : <CaretDownOutlined />}
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
          <Row>
            <Col span={24}>
              <Card title="Latest News" loading={this.state.loadingData}>
                <Timeline>
                  {this.state.news.map(title => <Timeline.Item key={title}>{title}</Timeline.Item>)}
                </Timeline>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    );
  }
}