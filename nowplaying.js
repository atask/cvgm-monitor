const cheerio = require('cheerio')

const SONG_ID_REGEX = /demovibes\/song\/(\d*)\//

module.exports = nowplayingData => {
  const $ = cheerio.load(nowplayingData)
  let songNode = $('a[href^="/demovibes/song/"]')
  let name = songNode.text()
  let id = parseInt(SONG_ID_REGEX.exec(songNode.attr('href'))[1], 10)

  return { id, name }
}
