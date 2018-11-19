'use strict'

let baseUrl = process.env.BASE_URL || 'https://img.shields.io'
if (baseUrl.endsWith('/')) {
  baseUrl = baseUrl.slice(0, baseUrl.length - 1)
}

module.exports = {
  baseUrl,
}
