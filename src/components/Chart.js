import React from 'react'
import withHooks, { useEffect, useRef, useState, useMemo } from '../utils/hooks'
//
import ChartContext from '../utils/ChartContext'
import Utils from '../utils/Utils'
import * as Debug from '../utils/Debug'
import buildAxis from '../utils/buildAxis'

import useHyperResponsive from '../utils/useHyperResponsive'
import ChartInner from './ChartInner'
import TooltipRenderer from './TooltipRenderer'

import Line from '../seriesTypes/Line'
import Bubble from '../seriesTypes/Bubble'
import Area from '../seriesTypes/Area'
import Bar from '../seriesTypes/Bar'
// import Pie from '../seriesTypes/Pie'

const debug = process.env.NODE_ENV === 'development' && false

const modePrimary = 'primary'
const modeSecondary = 'secondary'

const seriesTypes = {
  line: Line,
  bubble: Bubble,
  area: Area,
  bar: Bar
  // pie: Pie
}

const defaultColors = [
  '#4ab5eb',
  '#fc6868',
  '#DECF3F',
  '#60BD68',
  '#FAA43A',
  '#c63b89',
  '#1aaabe',
  '#734fe9',
  '#1828bd',
  '#cd82ad'
]

const defaultCursorProps = {
  render: ({ formattedValue }) => <span>{formattedValue}</span>,
  snap: true,
  showLine: true,
  showLabel: true,
  axisID: undefined,
  onChange: () => {}
}

function Chart(
  {
    data,
    interaction,
    hoverMode,
    groupMode,
    showVoronoi,
    dark,
    type,
    axes,
    primaryCursor,
    secondaryCursor,
    tooltip,
    brush,
    onHover,
    renderSVG,
    getSeries,
    getDatums,
    getLabel,
    getSeriesID,
    getPrimary,
    getSecondary,
    getR,
    getPrimaryAxisID,
    getSecondaryAxisID,
    getStyles,
    getDatumStyles,
    ...rest
  },
  ref
) {
  // Tooltip defaults
  tooltip = {
    align: 'auto',
    alignPriority: [
      'right',
      'topRight',
      'bottomRight',
      'left',
      'topLeft',
      'bottomLeft',
      'top',
      'bottom'
    ],
    padding: 5,
    tooltipArrowPadding: 7,
    focus: 'closest',
    render: TooltipRenderer,
    onChange: () => {},
    ...tooltip
  }

  let [
    { hovered, axisDimensions, offset, padding, pointer },
    setChartState
  ] = useState({
    hovered: {
      active: false,
      series: null,
      datums: []
    },
    axisDimensions: {},
    padding: {},
    offset: {},
    pointer: {}
  })

  const [{ width, height }, handleRef] = useHyperResponsive()

  const getStylesRef = useRef()
  const getDatumStylesRef = useRef()

  getStylesRef.current = getStyles
  getDatumStylesRef.current = getDatumStyles

  let materializedData = useMemo(
    () => {
      if (debug) console.info('materialize')
      // Check for data
      if (!data) {
        if (debug) Debug.noData()
        return
      }

      // getSeries
      const series = Utils.normalizeGetter(getSeries)(data)

      // Check for data
      if (!series) {
        if (debug) Debug.noData()
        return
      }

      // First access the data, and provide it to the context
      return series.map((s, seriesIndex) => {
        const seriesID = Utils.normalizeGetter(getSeriesID)(
          s,
          seriesIndex,
          data
        )
        const seriesLabel = Utils.normalizeGetter(getLabel)(
          s,
          seriesIndex,
          data
        )
        const primaryAxisID = Utils.normalizeGetter(getPrimaryAxisID)(
          s,
          seriesIndex,
          data
        )
        const secondaryAxisID = Utils.normalizeGetter(getSecondaryAxisID)(
          s,
          seriesIndex,
          data
        )
        const series = {
          original: s,
          index: seriesIndex,
          id: seriesID,
          label: seriesLabel,
          primaryAxisID,
          secondaryAxisID,
          datums: Utils.normalizeGetter(getDatums)(s, seriesIndex, data).map(
            (d, index) => ({
              originalSeries: s,
              seriesIndex,
              seriesID,
              seriesLabel,
              index,
              original: d,
              primary: Utils.normalizeGetter(getPrimary)(
                d,
                index,
                s,
                seriesIndex,
                data
              ),
              secondary: Utils.normalizeGetter(getSecondary)(
                d,
                index,
                s,
                seriesIndex,
                data
              ),
              r: Utils.normalizeGetter(getR)(d, index, s, seriesIndex, data)
            })
          )
        }
        return series
      })
    },
    [data]
  )

  const preResolvedSeriesTypes = materializedData.map((series, seriesIndex) => {
    const resolvedType =
      typeof type === 'function' ? type(series, seriesIndex) : type
    const seriesType = seriesTypes[resolvedType]
    if (!seriesType) {
      throw new Error(
        `Could not find a registered series type for ${resolvedType}`
      )
    }
    return seriesType
  })

  materializedData = useMemo(
    () => {
      if (debug) console.info('materialize2')
      return materializedData
        .map((series, i) => {
          series.Component = preResolvedSeriesTypes[i]
          return series
        })
        .map((series, i, all) => {
          const seriesTypeIndex = all.filter(
            (d, j) => j < i && d.Component === series.Component
          ).length
          return {
            ...series,
            seriesTypeIndex,
            datums: series.datums.map(datum => ({
              ...datum,
              seriesTypeIndex
            }))
          }
        })
    },
    [materializedData, ...preResolvedSeriesTypes]
  )

  // Calculate:
  // offset
  // gridX
  // gridY
  // gridWidth
  // gridHeight
  offset = useMemo(
    () => {
      if (debug) console.info('offset', offset)
      return {
        left: offset.left || 0,
        top: offset.top || 0
      }
    },
    [offset]
  )
  const [gridX, gridY, gridWidth, gridHeight] = useMemo(
    () => {
      if (debug) console.info('coords')
      // Left
      const axesLeftWidth =
        (axisDimensions.left && Utils.sumObjBy(axisDimensions.left, 'width')) ||
        0
      const axesLeftTop =
        (axisDimensions.left && Utils.sumObjBy(axisDimensions.left, 'top')) || 0
      const axesLeftBottom =
        (axisDimensions.left &&
          Utils.sumObjBy(axisDimensions.left, 'bottom')) ||
        0

      // Right
      const axesRightWidth =
        (axisDimensions.right &&
          Utils.sumObjBy(axisDimensions.right, 'width')) ||
        0
      const axesRightTop =
        (axisDimensions.right && Utils.sumObjBy(axisDimensions.right, 'top')) ||
        0
      const axesRightBottom =
        (axisDimensions.right &&
          Utils.sumObjBy(axisDimensions.right, 'bottom')) ||
        0

      // Top
      const axesTopHeight =
        (axisDimensions.top && Utils.sumObjBy(axisDimensions.top, 'height')) ||
        0
      const axesTopLeft =
        (axisDimensions.top && Utils.sumObjBy(axisDimensions.top, 'left')) || 0
      const axesTopRight =
        (axisDimensions.top && Utils.sumObjBy(axisDimensions.top, 'right')) || 0

      // Bottom
      const axesBottomHeight =
        (axisDimensions.bottom &&
          Utils.sumObjBy(axisDimensions.bottom, 'height')) ||
        0
      const axesBottomLeft =
        (axisDimensions.bottom &&
          Utils.sumObjBy(axisDimensions.bottom, 'left')) ||
        0
      const axesBottomRight =
        (axisDimensions.bottom &&
          Utils.sumObjBy(axisDimensions.bottom, 'right')) ||
        0

      const paddingLeft = padding.left || 0
      const paddingRight = padding.right || 0
      const paddingTop = padding.top || 0
      const paddingBottom = padding.bottom || 0

      const gridX =
        paddingLeft + Math.max(axesLeftWidth, axesTopLeft, axesBottomLeft)

      const gridY =
        paddingTop + Math.max(axesTopHeight, axesLeftTop, axesRightTop)

      const gridWidth =
        width -
        paddingLeft -
        paddingRight -
        Math.max(axesLeftWidth, axesTopLeft, axesBottomLeft) -
        Math.max(axesRightWidth, axesTopRight, axesBottomRight)

      const gridHeight =
        height -
        paddingTop -
        paddingBottom -
        Math.max(axesTopHeight, axesLeftTop, axesRightTop) -
        Math.max(axesBottomHeight, axesLeftBottom, axesRightBottom)

      return [gridX, gridY, gridWidth, gridHeight]
    },
    [width, height, axisDimensions, padding]
  )

  // Detect axes changes and build axes
  let prePrimaryAxes = axes.filter(d => d.primary)
  let preSecondaryAxes = axes.filter(d => !d.primary)

  const primaryAxesHashes = JSON.stringify(prePrimaryAxes)
  const secondaryAxesHashes = JSON.stringify(preSecondaryAxes)

  // Calculate primary axes
  const primaryAxes = useMemo(
    () => {
      if (debug) console.info('primaryAxes')
      return prePrimaryAxes.map((axis, i) => {
        return buildAxis({
          axis,
          materializedData,
          gridWidth,
          gridHeight
        })
      })
    },
    [primaryAxesHashes, materializedData, gridHeight, gridWidth]
  )
  // Calculate secondary axes
  const secondaryAxes = useMemo(
    () => {
      if (debug) console.info('secondaryAxes')
      return preSecondaryAxes.map((axis, i) => {
        return buildAxis({
          axis,
          primaryAxes,
          materializedData,
          gridWidth,
          gridHeight
        })
      })
    },
    [secondaryAxesHashes, materializedData, gridHeight, gridWidth]
  )

  // Make stackData
  const stackData = useMemo(
    () => {
      if (debug) console.info('stackData')
      // We need materializedData and both axes to continue
      if (!primaryAxes.length || !secondaryAxes.length) {
        throw new Error('A primary and secondary axis is required!')
      }

      // If the axes are ready, let's decorate the materializedData for visual plotting
      // const secondaryStacked = secondaryAxes.stacked

      // Make sure we're mapping x and y to the correct axes
      const xKey = primaryAxes.find(d => d.vertical) ? 'secondary' : 'primary'
      const yKey = primaryAxes.find(d => d.vertical) ? 'primary' : 'secondary'
      const xAxes = primaryAxes.find(d => d.vertical)
        ? secondaryAxes
        : primaryAxes
      const yAxes = primaryAxes.find(d => d.vertical)
        ? primaryAxes
        : secondaryAxes

      // "totals" are kept per secondaryAxis and used for bases if secondaryAxis stacking is enabled
      const scaleTotals = secondaryAxes.map(() => ({}))
      materializedData.forEach(series => {
        const axisIndex = Utils.getAxisIndexByAxisID(
          secondaryAxes,
          series.secondaryAxisID
        )
        series.datums.forEach(datum => {
          scaleTotals[axisIndex][datum.primary] = {
            negative: 0,
            positive: 0
          }
        })
      })

      // Determine the correct primary and secondary values for each axis
      // Also calculate bases and totals if either axis is stacked
      let stackData = materializedData.map(series => {
        const primaryAxisIndex = Utils.getAxisIndexByAxisID(
          primaryAxes,
          series.primaryAxisID
        )
        const primaryAxis = primaryAxes[primaryAxisIndex]
        const secondaryAxisIndex = Utils.getAxisIndexByAxisID(
          secondaryAxes,
          series.secondaryAxisID
        )
        const secondaryAxis = secondaryAxes[secondaryAxisIndex]
        return {
          ...series,
          datums: series.datums.map(d => {
            const datum = {
              ...d,
              xValue: d[xKey],
              yValue: d[yKey],
              baseValue: 0
            }
            if (secondaryAxis.stacked) {
              const start = scaleTotals[secondaryAxisIndex][d.primary]
              // Stack the x or y values (according to axis positioning)
              if (primaryAxis.vertical) {
                // Is this a valid point?
                const validPoint = Utils.isValidPoint(datum.xValue)
                // Should we use positive or negative base?
                const totalKey = datum.xValue >= 0 ? 'positive' : 'negative'
                // Assign the base
                datum.baseValue = start[totalKey]
                // Add the value for a total
                datum.totalValue =
                  datum.baseValue + (validPoint ? datum.xValue : 0)
                // Update the totals
                scaleTotals[secondaryAxisIndex][d.primary][totalKey] =
                  datum.totalValue
                // Make the total the new value
                datum.xValue = validPoint ? datum.totalValue : null
              } else {
                // Is this a valid point?
                const validPoint = Utils.isValidPoint(datum.yValue)
                // Should we use positive or negative base?
                const totalKey = datum.yValue >= 0 ? 'positive' : 'negative'
                // Assign the base
                datum.baseValue = start[totalKey]
                // Add the value to the base
                datum.totalValue =
                  datum.baseValue + (validPoint ? datum.yValue : 0)
                // Update the totals
                scaleTotals[secondaryAxisIndex][d.primary][totalKey] =
                  datum.totalValue
                // Make the total the new value
                datum.yValue = validPoint ? datum.totalValue : null
              }
            }
            return datum
          })
        }
      })

      stackData.forEach(series => {
        series.datums.forEach(datum => {
          datum.series = series
        })
      })

      // Use the plotDatum method on each series
      stackData.forEach((series, i) => {
        if (debug && !series.Component.plotDatum) {
          throw new Error(
            `Could not find a [SeriesType].plotDatum() static method for the series Component above (index: ${i})`
          )
        }

        const primaryAxisIndex = Utils.getAxisIndexByAxisID(
          primaryAxes,
          series.primaryAxisID
        )
        const secondaryAxisIndex = Utils.getAxisIndexByAxisID(
          secondaryAxes,
          series.secondaryAxisID
        )

        const primaryAxis = primaryAxes[primaryAxisIndex]
        const secondaryAxis = secondaryAxes[secondaryAxisIndex]

        const xAxisIndex = Utils.getAxisIndexByAxisID(
          xAxes,
          series[`${xKey}AxisID`]
        )
        const yAxisIndex = Utils.getAxisIndexByAxisID(
          yAxes,
          series[`${yKey}AxisID`]
        )

        const xAxis = xAxes[xAxisIndex]
        const yAxis = yAxes[yAxisIndex]

        series.datums = series.datums.map(d => {
          // Data for cartesian charts
          const result = series.Component.plotDatum(d, {
            primaryAxis,
            secondaryAxis,
            xAxis,
            yAxis
          })

          return result || d
        })
      })

      // Do any data grouping ahead of time
      if ([modePrimary, modeSecondary].includes(groupMode)) {
        const datumsByGrouping = {}

        stackData.forEach(series => {
          series.datums.filter(d => d.defined).forEach(datum => {
            const axisKey = String(
              groupMode === modePrimary ? datum.primary : datum.secondary
            )

            datumsByGrouping[axisKey] = datumsByGrouping[axisKey] || []
            datumsByGrouping[axisKey].push(datum)
          })
        })

        stackData.forEach(series => {
          series.datums.forEach(datum => {
            const axisKey = String(
              groupMode === modePrimary ? datum.primary : datum.secondary
            )

            datum.group = datumsByGrouping[axisKey]
          })
        })
      }

      // Not we need to precalculate all of the possible status styles by
      // calling the seemingly 'live' getStyles, and getDatumStyles callbacks ;)
      stackData = stackData.map((series, i) => {
        if (debug && !series.Component.buildStyles) {
          throw new Error(
            `Could not find a SeriesType.buildStyles() static method for the series Component above (index: ${i})`
          )
        }
        const result = series.Component.buildStyles(series, {
          // Make sure we are using a thunk to get the most recent getStyles and getDatumStyles
          getStyles: (...args) => getStylesRef.current(...args),
          getDatumStyles: (...args) => getDatumStylesRef.current(...args),
          defaultColors
        })

        return result || series
      })

      return stackData
    },
    [primaryAxes, secondaryAxes, groupMode]
  )

  // Calculate Tooltip
  tooltip = useMemo(
    () => {
      const hoveredDatums =
        hovered.datums && hovered.datums.length ? hovered.datums : []

      // Get the closest focus datum out of the hoveredDatums
      const focusedDatum = Utils.getClosestPoint(pointer, hoveredDatums)

      let focused = {}

      // If there is a focusedDatum, default the focus to its x and y
      if (focusedDatum) {
        focused = focusedDatum.focus
      }

      if (typeof tooltip.focus === 'function') {
        // Support functional override for focus
        if (pointer) {
          focused = tooltip.focus({
            hoveredDatums,
            pointer,
            focusedDatum
          })
        }
      } else if (tooltip.focus === 'pointer') {
        // Support pointer-bound focus
        focused = pointer
      } else if (tooltip.focus === 'closest') {
        // Do nothing, this is already calculated
      } else if (hoveredDatums && hoveredDatums.length) {
        // Support manual definition of focus point using relative multiFocus strategy
        const multiFocus = Array.isArray(tooltip.focus)
          ? [...tooltip.focus]
          : [tooltip.focus]
        focused = Utils.getMultiFocus({
          focus: multiFocus,
          points: hoveredDatums,
          gridX,
          gridY,
          gridWidth,
          gridHeight,
          width,
          height
        })
      }

      focused = focused
        ? {
          horizontalPadding: focused.horizontalPadding || 0,
          verticalPadding: focused.verticalPadding || 0,
          ...focused
        }
        : focused

      const newTooltip = {
        focused,
        focusedDatum,
        show: hovered.active,
        ...tooltip
      }

      return newTooltip
    },
    [hovered, pointer, tooltip]
  )

  // Cursors
  ;[primaryCursor, secondaryCursor] = [primaryCursor, secondaryCursor].map(
    (cursor, i) => {
      return useMemo(
        () => {
          const primary = i === 0
          cursor = {
            ...defaultCursorProps,
            ...cursor,
            primary
          }

          let value
          let show = false
          let datum

          if (hovered && hovered.datums && hovered.datums.length) {
            datum = Utils.getClosestPoint(pointer, hovered.datums)
          }

          // Determine the axis to use
          const axis = Utils.getAxisByAxisID(
            primary ? primaryAxes : secondaryAxes,
            cursor.axisID || datum
              ? datum.series[primary ? 'primaryAxisID' : 'secondaryAxisID']
              : undefined
          )

          const siblingAxis = primary ? secondaryAxes[0] : primaryAxes[0]

          // Resolve the invert function
          const invert = axis.scale.invert || (d => d)

          // If the pointer is active, try to show
          if (pointer.active) {
            // Default to cursor x and y
            let x = pointer.x
            let y = pointer.y
            // If the cursor isn't in the grid, don't display
            if (x < -1 || x > gridWidth + 1 || y < -1 || y > gridHeight + 1) {
              show = false
            } else {
              show = true
            }

            // Implement snapping
            if (axis.type === 'ordinal' || cursor.snap) {
              if (!datum) {
                show = false
              } else {
                // For snapping we need the hovered datums
                if (axis.vertical) {
                  value = datum.yValue
                } else {
                  value = datum.xValue
                }
              }
            } else if (axis.vertical) {
              value = invert(y)
            } else {
              value = invert(x)
            }
          } else {
            show = false
          }

          const computedValue = value

          if (typeof cursor.value !== 'undefined' && cursor.value !== null) {
            show = true
            value = cursor.value
          }

          if (typeof cursor.show !== 'undefined') {
            show = cursor.show
          }

          return {
            ...cursor,
            axis,
            siblingAxis,
            show,
            value,
            computedValue,
            datum
          }
        },
        [stackData, pointer, hovered, cursor && cursor.value]
      )
    }
  )

  useEffect(
    () => {
      tooltip.onChange(tooltip)
      primaryCursor.onChange(primaryCursor)
      secondaryCursor.onChange(secondaryCursor)
    },
    [pointer]
  )

  useEffect(
    () => {
      if (brush && pointer.released) {
        if (Math.abs(pointer.sourceX - pointer.x) < 20) {
          return
        }
        brush.onSelect({
          pointer: pointer.released,
          start: primaryAxes[0].scale.invert(pointer.sourceX),
          end: primaryAxes[0].scale.invert(pointer.x)
        })
      }
    },
    [pointer.released]
  )

  // Decorate the chartState with computed values (or ones we just
  // want to pass down through context)
  const chartState = {
    hovered,
    pointer,
    tooltip,
    axisDimensions,
    offset,
    padding,
    width,
    height,
    interaction,
    brush,
    hoverMode,
    groupMode,
    showVoronoi,
    materializedData,
    stackData,
    primaryAxes,
    secondaryAxes,
    primaryCursor,
    secondaryCursor,
    gridX,
    gridY,
    gridWidth,
    gridHeight,
    dark,
    renderSVG
  }

  const chartStateContextValue = [chartState, setChartState]

  return (
    <ChartContext.Provider value={chartStateContextValue}>
      <ChartInner {...rest} handleRef={handleRef} />
    </ChartContext.Provider>
  )
}

Chart.defaultProps = {
  getSeries: d => d,
  getDatums: d => (Array.isArray(d) ? d : d.datums || d.data),
  getLabel: (d, i) => d.label || `Series ${i + 1}`,
  getSeriesID: (d, i) => i,
  getPrimary: d => (Array.isArray(d) ? d[0] : d.primary || d.x),
  getSecondary: d => (Array.isArray(d) ? d[1] : d.secondary || d.y),
  getR: d => (Array.isArray(d) ? d[2] : d.radius || d.r),
  getPrimaryAxisID: s => s.primaryAxisID,
  getSecondaryAxisID: s => s.secondaryAxisID,
  getStyles: () => ({}),
  getDatumStyles: () => ({}),
  onHover: () => {},
  interaction: null,
  hoverMode: 'primary',
  groupMode: 'primary',
  showVoronoi: false
}

export default withHooks(Chart)
