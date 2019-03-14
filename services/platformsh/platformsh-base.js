'use strict'

const log = require('../../lib/log')
const Joi = require('joi')
const BaseJsonService = require('../base-json')
const serverSecrets = require('../../lib/server-secrets')
const {
  errorResponseSchema,
  oauthTokenResponseSchema,
} = require('./platformsh-schema')

const oauthAuthorization = (function() {
  const {
    platformsh_oauth_clientid: clientid,
    platformsh_oauth_clientsecret: secret,
  } = serverSecrets

  const token = `${clientid}:${secret}`
  return Buffer.from(token, 'utf-8').toString('base64')
})()

const clouds = {
  platformsh: {
    accounts: 'https://accounts.platform.sh',
    label: 'Platform.sh',
    logo: 'platformsh',
    color: '#16A9E1',
    apiToken: serverSecrets.platformsh_api_token,
  },
  magentocloud: {
    accounts: 'https://accounts.magento.cloud',
    label: 'Magento Cloud',
    logo: 'magento',
    color: '#F26322',
    apiToken: serverSecrets.magentocloud_api_token,
  },
  symfonycloud: {
    accounts: 'https://accounts.sensio.cloud',
    label: 'Symfony Cloud',
    logo: 'symfony',
    color: '#007DBD',
    apiToken: serverSecrets.symfonycloud_api_token,
  },
  sensiocloud: { alias: 'symfonycloud' },
  s5yio: { alias: 'symfonycloud' },
}

class CloudProvider {
  constructor({ baseUrl, label, logo, color, apiToken }, { persistence }) {
    this.baseUrl = baseUrl
    this.label = label
    this.logo = logo
    this.color = color
    this.apiToken = apiToken
    this.persistence = persistence
  }

  async _invalidateCachedToken() {
    await this.persistence.deleteToken(this)
  }

  async getAccessToken(request) {
    const cache = await this.persistence.getToken(this)
    if (cache && cache.tokenType && cache.accessToken) {
      return cache
    }

    const {
      access_token: accessToken,
      expires_in: expiresIn,
      token_type: tokenType,
      scope,
      refresh_token: refreshToken,
    } = await request({
      schema: oauthTokenResponseSchema,
      url: `${this.baseUrl}/oauth2/token`,
      options: {
        headers: {
          Authorization: `Basic ${oauthAuthorization}`,
        },
        form: {
          grant_type: 'api_token',
          api_token: this.apiToken,
        },
      },
    })
    const token = {
      apiToken: this.apiToken,
      accessToken,
      expiresIn,
      tokenType,
      scope,
      refreshToken,
    }
    await this.persistence.setToken(token)
    return token
  }
}

class BasePlatformService extends BaseJsonService {
  constructor(requestConfig, { tokenCache, ...serviceConfig }) {
    super(requestConfig, serviceConfig)
    this.persistence = tokenCache
  }

  getCloud(name) {
    const cleanname = name.replace(/[.-]?/, '')
    const optname = `${cleanname}cloud`
    const cloud = clouds[cleanname] || clouds[optname]

    if (cloud && cloud.alias) {
      return this.getCloud(cloud.alias)
    }

    return new CloudProvider(cloud, this)
  }

  static get category() {
    return 'build'
  }

  static get route() {
    const cloudPattern =
      '(platform[.-]?sh|(?:magento|sensio|symfony)(?:[.-]?cloud)?|s5y[.-]?io)'

    return {
      base: '',
      format: `${cloudPattern}/([^/]+)(?:/(.*))?`,
      capture: ['cloud', 'project', 'branch'],
    }
  }

  static get examples() {
    return [
      {
        title: 'Platform.sh',
        pattern: ':cloud/:project/:branch',
        namedParams: {
          cloud: 'platformsh',
          project: 'e7zbienieag5q',
          branch: 'master',
        },
      },
      {
        title: 'Magento Cloud',
        pattern: ':cloud/:project/:branch',
        namedParams: {
          cloud: 'magento-cloud',
          project: 'znwag747txg3g',
          branch: 'master',
        },
      },
      {
        title: 'Symfony Cloud',
        pattern: ':cloud/:project/:branch',
        namedParams: {
          cloud: 's5y.io',
          project: 'nqknp632nz4yy',
          branch: 'master',
        },
      },
    ]
  }

  async _requestJson({ schema, ...other }) {
    schema = Joi.alternatives().try(schema, errorResponseSchema)
    return super._requestJson({ schema, ...other })
  }

  async _getAccessToken({ cloud }) {
    if (!(cloud instanceof CloudProvider)) {
      cloud = this.getCloud(cloud)
    }

    const { accessToken } = await cloud.getAccessToken(
      this._requestJson.bind(this)
    )
    return accessToken
  }

  async _getProjectInfo({ accounts, accessToken, project }) {
    throw new Error('not implemented')
  }

  async _getProject({ endpoint, accessToken }) {
    throw new Error('not implemented')
  }

  async _getEnvironment({ endpoint, accessToken, branch }) {
    throw new Error('not implemented')
  }

  async handle({ cloud, project, branch }) {
    const cloudData = getCloud(cloud)
    const { accounts, apiToken } = cloudData
    const accessToken = await this._getAccessToken({ accounts, apiToken })
    const projectInfo = await this._getProjectInfo({
      accounts,
      accessToken,
      project,
    })
    const { endpoint } = projectInfo
    const projectData = await this._getProject({ endpoint, accessToken })
    const environmentData = await this._getEnvironment({
      endpoint,
      accessToken,
      branch,
    })
    const result = Object.assign({}, cloudData, projectData, environmentData)
    return result
  }
}

module.exports = BasePlatformService
