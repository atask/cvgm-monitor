const test = require('tape')
const fsPromises = require('fs').promises
const proxyquire = require('proxyquire')
const sinon = require('sinon')

const fixtureIndex = fsPromises.readFile('./test/fixture-index.txt', 'utf8')
const fixtureEvent = fsPromises.readFile('./test/fixture-event-1.txt', 'utf8')
const fixtureNowPlaying = fsPromises.readFile('./test/fixture-nowplaying-1.txt', 'utf8')

test('monitor should a connection event once connected to cvgm.net', t => {
  let fetchStub = sinon.stub()
  fetchStub.withArgs('http://www.cvgm.net')
    .returns({ ok: true, text: () => fixtureIndex })
  let CVGMMonitor = proxyquire('../monitor.js', { 'node-fetch': fetchStub })

  let monitor = new CVGMMonitor()
  t.plan(1)
  monitor.connect()
    .on('connection', () => {
      monitor.disconnect()
      t.pass('connection event was fired')
      sinon.restore()
      t.end()
    })
})

test('monitor emits an error event if connection is unsuccessful', t => {
  let fetchStub = sinon.stub()
  fetchStub.withArgs('http://www.cvgm.net')
    .returns({ ok: false })
  let CVGMMonitor = proxyquire('../monitor.js', { 'node-fetch': fetchStub })

  let monitor = new CVGMMonitor()
  t.plan(1)
  monitor.connect()
    .on('error', () => {
      monitor.disconnect()
      t.pass('error event was fired')
      sinon.restore()
      t.end()
    })
})

test('monitor should emit when a new song plays', t => {
  let fetchStub = sinon.stub()
  fetchStub.withArgs('http://www.cvgm.net')
    .returns({ ok: true, text: () => fixtureIndex })
  fetchStub.withArgs('http://www.cvgm.net/demovibes/ajax/ping/8386274/')
    .returns({ ok: true, text: () => fixtureEvent })
  fetchStub.withArgs('http://www.cvgm.net/demovibes/ajax/nowplaying/?event=8386274')
    .returns({ ok: true, text: () => fixtureNowPlaying })
  let CVGMMonitor = proxyquire('../monitor.js', { 'node-fetch': fetchStub })

  let monitor = new CVGMMonitor()
  t.plan(1)
  monitor.connect()
    .on('nowplaying', () => {
      monitor.disconnect()
      t.pass('nowplaying event was fired')
      sinon.restore()
      t.end()
    })
})

test('monitor retries current poll id when connection unsuccessful', t => {
  let setTimeout = global.setTimeout
  let setTimeoutFake = sinon.fake(fn => setTimeout(fn, 0))
  sinon.replace(global, 'setTimeout', setTimeoutFake)
  let fetchStub = sinon.stub()
  fetchStub.withArgs('http://www.cvgm.net')
    .returns({ ok: true, text: () => fixtureIndex })
  fetchStub.withArgs('http://www.cvgm.net/demovibes/ajax/ping/8386274/')
    .onFirstCall().returns({ ok: false })
    .onSecondCall().returns({ ok: true, text: () => fixtureEvent })
  fetchStub.withArgs('http://www.cvgm.net/demovibes/ajax/nowplaying/?event=8386274')
    .returns({ ok: true, text: () => fixtureNowPlaying })
  let CVGMMonitor = proxyquire('../monitor.js', { 'node-fetch': fetchStub })

  let monitor = new CVGMMonitor()
  t.plan(1)
  monitor.connect()
    .on('nowplaying', () => {
      monitor.disconnect()
      t.equal(setTimeoutFake.lastCall.lastArg, 15000, 'monitor waited longer on second call')
      sinon.restore()
      t.end()
    })
})
