'use strict'

const { colorScale } = require('../../lib/color-formatters')
const {
  checkErrorResponse: standardCheckErrorResponse,
} = require('../../lib/error-helper')
const { baseUrl } = require('../../lib/constants')

const documentation = `
<p>
  If your GitHub badge errors, it might be because you hit GitHub's rate limits.
  <br>
  You can increase Shields.io's rate limit by
  <a href="${baseUrl}/github-auth">going to this page</a> to add
  Shields as a GitHub application on your GitHub account.
</p>
`

function stateColor(s) {
  return { open: '2cbe4e', closed: 'cb2431', merged: '6f42c1' }[s]
}

function errorMessagesFor(notFoundMessage = 'repo not found') {
  return {
    404: notFoundMessage,
    422: notFoundMessage,
  }
}

function checkErrorResponse(
  badgeData,
  err,
  res,
  notFoundMessage = 'repo not found',
  errorMessages = {}
) {
  return standardCheckErrorResponse(badgeData, err, res, {
    ...errorMessages,
    ...errorMessagesFor(notFoundMessage),
  })
}

const commentsColor = colorScale([1, 3, 10, 25], undefined, true)

module.exports = {
  documentation,
  stateColor,
  commentsColor,
  errorMessagesFor,
  checkErrorResponse,
}
