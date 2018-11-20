'use strict'

const Joi = require('joi')
const serverSecrets = require('../../lib/server-secrets')

const isPipelineStatus = Joi.equal(
  'pending',
  'running',
  'passed',
  'failed',
  'skipped',
  'canceled'
).required()

module.exports = {
  isPipelineStatus,
}

if (serverSecrets && serverSecrets.gitlab_base_url) {
  module.exports.gitlabBaseUrl = serverSecrets.gitlab_base_url
} else {
  module.exports.gitlabBaseUrl = 'https://gitlab.com'
}

if (serverSecrets && serverSecrets.gitlab_access_token) {
  module.exports.gitlabAccessToken = serverSecrets.gitlab_access_token
}
