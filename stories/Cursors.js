import React, { Component } from 'react'
import _ from 'lodash'
import { ResizableBox } from 'react-resizable'
//
import { Chart, Axis, Data, Tooltip, Cursor } from '../src'
//
// import CodeHighlight from './components/codeHighlight.js'

class Line extends Component {
  constructor () {
    super()
    this.state = {
      data: makeData()
    }
  }
  render () {
    const {
      data
    } = this.state
    return (
      <div>
        <button
          onClick={() => this.setState({
            data: makeData()
          })}
        >
          Randomize Data
        </button>

        <br />
        <br />

        {_.range(1).map((d, i) => (
          <ResizableBox
            key={i}
            width={500}
            height={300}
          >
            <Chart
              data={data}
              getData={d => d.data}
            >
              <Axis
                primary
                type='time'
                position='bottom'
              />
              <Axis
                type='linear'
                position='left'
                stacked
                cursor={{

                }}
              />
              <Data
                type='area'
              />
              <Tooltip />
              <Cursor
                primary
              />
              <Cursor />
            </Chart>
          </ResizableBox>
        ))}

        <br />
        <br />
      </div>
    )
  }
}

export default () => <Line />

function makeData () {
  return _.map(_.range(Math.max(Math.round((Math.random() * 4)), 1)), makeSeries)
}

function makeSeries (i) {
  const startDate = new Date()
  // const length = Math.round(Math.random() * 30)
  const length = 30
  const max = 100
  // const max = Math.random() > 0.5 ? 100000 : 10
  // const multiplier = 10
  // const multiplier = Math.round((Math.random() * 10) + Math.round(Math.random() * 50))
  return {
    label: 'Series ' + (i + 1),
    data: _.map(_.range(length), d => {
      let date = new Date()
      date.setMinutes(startDate.getMinutes() + (30 * d))
      date.setSeconds(0)
      date = date.setMilliseconds(0)
      return {
        // x: d * multiplier,
        x: date,
        y: Math.round(Math.random() * (max) + Math.round(Math.random() * 50)),
        r: Math.round(Math.random() * 5)
      }
    })
  }
}