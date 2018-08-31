const EventEmitter = require('events')
const fetch = require('node-fetch')
const capitalize = require('capitalize')
const debug = require('debug')('cvgm-monitor')
const parseNowplaying = require('./nowplaying.js')

const BASE_URL = 'http://www.cvgm.net'
const MONITOR_URL = `${BASE_URL}/demovibes/ajax`
const EVENT_ID_REGEX = /onload="ajaxmonitor\((\d*)\);"/
const HANDLED_EVENTS = ['nowplaying']
const LONG_TIMEOUT = 300000
const FAIL_DELAY = 15000
const BOOST = 1000

class Monitor extends EventEmitter {
  constructor (options) {
    super()

    this._eventId = null
    this._updateTimer = null
    this._abortConnection = false
  }

  _initFetch (agent = null) {
    let fetchOptions = { compress: false, agent }
    let longFetchOptions = { compress: false, agent, timeout: LONG_TIMEOUT }
    this.fetch = url => fetch(url, fetchOptions)
    this.longFetch = url => fetch(url, longFetchOptions)
  }

  async _getInitialId (isRetry) {
    let index = await this._fetchIndexPage()
    return EVENT_ID_REGEX.exec(index)[1]
  }

  async _fetchIndexPage () {
    debug('fetching cvgm index')
    let response = await this.fetch(BASE_URL)
    if (response.ok) { return response.text() }
    throw new Error('Network response was not ok.')
  }

  async _fetchEventIndex (eventId) {
    debug(`fetching index for event ${eventId}`)
    let response = await this.longFetch(`${MONITOR_URL}/ping/${eventId}/`)
    if (response.ok) { return response.text() }
    throw new Error('Network response was not ok.')
  }

  async _fetchEventData (eventName, eventId) {
    debug(`fetching data for event ${eventId} [${eventName}]`)
    let response = await this.fetch(`${MONITOR_URL}/${eventName}/?event=${eventId}`)
    if (response.ok) { return response.text() }
    throw new Error('Network response was not ok.')
  }

  _parseNowplayingData (data, emitter) {
    return parseNowplaying(data)
  }

  connect ({ agent = null } = {}) {
    this._initFetch(agent)
    this._abortConnection = false
    this._getInitialId()
      .then(id => {
        this._eventId = id
        this.emit('connection')
        this._startPolling()
      })
      .catch(e => {
        this.emit('error', e)
      })
    return this
  }

  disconnect () {
    if (this._updateTimer) {
      clearTimeout(this._updateTimer)
    }
    this._abortConnection = true
  }

  _startPolling (time = 0) {
    if (!this._abortConnection) {
      this._updateTimer = setTimeout(this._poll.bind(this), time)
    }
  }

  async _poll () {
    try {
      let eventIndex = await this._fetchEventIndex(this._eventId)
      await this._handlePollEvents(eventIndex.split('\n'))
    } catch (e) {
      debug(`Error fetching poll ${this.eventId}: ${e.message}`)
      this._retryPoll()
    }
  }

  async _handlePollEvents (events) {
    for (let event of events) {
      // handle events
      if (HANDLED_EVENTS.includes(event)) {
        try {
          let eventData = await this._fetchEventData(event, this._eventId)
          let parseFnName = `_parse${capitalize(event)}Data`
          let parseFn = this[parseFnName]
          if (parseFn != null) {
            let parsed = parseFn(eventData)
            if (parsed != null) {
              this.emit(event, parsed)
            }
          }
        } catch (e) {
          debug(`Error handling event [${event}]: ${e.message}`)
        }
      }
      // handle next event id
      if (event.startsWith('!')) {
        this._eventId = parseInt(event.substring(1), 10)
      }
    }
    let nextDelay = Math.floor((Math.random() * BOOST))
    this._startPolling(nextDelay)
  }

  async _retryPoll () {
    this._startPolling(FAIL_DELAY)
  }
}

module.exports = Monitor
