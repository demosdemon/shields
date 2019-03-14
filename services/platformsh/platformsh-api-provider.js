'use strict'

const log = require('../../lib/log')
const serverSecrets = require('../../lib/server-secrets')
const { oauthTokenResponseSchema } = require('./platformsh-schema')
const RedisTokenCache = require('./redis-token-cache') // eslint-disable-line no-unused-vars

/**
 * An object with pertinent metadata about a cloud provider.
 *
 * @typedef {object} CloudData
 * @property {string} cloud The cloud identifier.
 * @property {string} apiToken The API token required for OAuth grants.
 * @property {string} baseUrl The root url for initial API calls.
 * @property {string} label The badge label.
 * @property {string} logo The badge logo.
 * @property {string} color The default badge color when no other color rule applies.
 */

/**
 * An object that contains a short-term API access token.
 *
 * @typedef {object} AccessToken
 * @property {string} accessToken The credentials.
 * @property {number} expiresIn The number of seconds before the token expires.
 * @property {number} expires The calculated unix microsecond timestamp of the expiration date.
 * @property {string} scope The access token scope. Usually 'account'.
 * @property {string} tokenType The access token type. Usually 'Bearer'.
 */

const wellKnownClouds = {
  platformsh: {
    baseUrl: 'https://accounts.platform.sh',
    label: 'Platform.sh',
    logo: 'platformsh',
    color: '#16A9E1',
  },
  magentocloud: {
    baseUrl: 'https://accounts.magento.cloud',
    label: 'Magento Cloud',
    logo: 'magento',
    color: '#F26322',
  },
  symfonycloud: {
    baseUrl: 'https://accounts.sensio.cloud',
    label: 'Symfony Cloud',
    logo: 'symfony',
    color: '#007DBD',
  },
  sensiocloud: { alias: 'symfonycloud' },
  s5yio: { alias: 'symfonycloud' },
}

/**
 * Platform.sh API Provider
 */
class PlatformshApiProvider {
  /**
   * Fetch the well known data for the named `cloud`. If the named `cloud` is an
   * alias, this method recursively returns the target.
   *
   * @param {string} cloud The cloud name.
   * @returns {CloudData} The cloud data object or undefined.
   * @private
   */
  static _getCloudKey(cloud) {
    const data = wellKnownClouds[cloud]
    if (data === undefined) {
      log(`_getCloudKey(${cloud}) returned undefined`)
      return undefined
    }

    if (data.alias) {
      return this._getCloudData(data.alias)
    }

    const apiToken = serverSecrets[`${cloud}_api_token`]
    if (apiToken === undefined) {
      log(`Found data for ${cloud} but did not find an API Token!`)
      return undefined
    }

    return {
      cloud,
      apiToken,
      ...data,
    }
  }

  /**
   * Fetch the well known cloud data for the named `cloud`. This method massages
   * the name first by removing a single period or hyphen and appending the
   * string 'cloud' if necessary. Thus, this method accepts::
   *
   *  platform-sh, platform.sh, platformsh, magento, magneto-cloud,
   *  magento.cloud, magentocloud, symfony, symfony-cloud, symfony.cloud,
   *  symfonycloud, sensio, sensio-cloud, sensio.cloud, sensiocloud, s5y-io,
   *  s5y.io, & s5yio
   *
   * @param {string} cloud The cloud name or alias.
   * @returns {CloudData} The cloud data object or undefined.
   * @private
   */
  static _getCloudData(cloud) {
    const cleankey = cloud.replace(/[.-]/, '')
    const altkey = `${cleankey}cloud`
    return this._getCloudKey(cleankey) || this._getCloudKey(altkey)
  }

  /**
   * Initialize the Platform.sh API provider with the specified `cloud` and
   * `tokenCache`.
   *
   * @param {{cloud: string, tokenCache: RedisTokenCache}} options
   */
  constructor({ cloud = 'platformsh', tokenCache }) {
    const meta = PlatformshApiProvider._getCloudData(cloud)
    if (meta == null) {
      return null
    }

    this.baseUrl = meta.baseUrl
    this.label = meta.label
    this.logo = meta.logo
    this.color = meta.color
    this.cloud = meta.cloud
    this.apiToken = meta.apiToken
    this.tokenCache = tokenCache
  }

  /**
   * Return the `Authorization` header required for Oauth Authentication.
   * @returns {string}
   */
  get oauthAuthorization() {
    const clientId = serverSecrets[`${this.cloud}_client_id`]
    if (clientId === undefined) {
      return undefined
    }

    const clientSecret = serverSecrets[`${this.cloud}_client_secret`] || ''
    const userpass = `${clientId}:${clientSecret}`
    const encoded = Buffer.from(userpass, 'utf-8').toString('base64')
    return `Basic ${encoded}`
  }

  /**
   * Return the key used to store the cached access token.
   * @returns {string}
   */
  get cacheKey() {
    return `${this.cloud}:${this.apiToken}`
  }

  /**
   * Delete the cached access token.
   */
  async invalidateCachedToken() {
    await this.tokenCache.deleteToken(this.cacheKey)
  }

  /**
   * Return the cached access token if it exists and is not expired.
   * @returns {Promise<AccessToken>} The access token or undefined.
   */
  async getCachedToken() {
    const cache = await this.tokenCache.getToken(this.cacheKey)
    if (
      cache &&
      cache.tokenType &&
      cache.accessToken &&
      (!cache.expires || (cache.expires && cache.expires < Date.now()))
    ) {
      return cache
    }
  }

  async getAccessToken(requestJson) {
    const cache = await this.getCachedToken()
    if (cache !== undefined) return cache

    const reply = await requestJson({
      schema: oauthTokenResponseSchema,
      url: `${this.baseUrl}/oauth2/token`,
      options: {
        headers: {
          Accept: 'application/json',
          Authorization: this.oauthAuthorization,
        },
      },
    })

    const {
      access_token: accessToken,
      expires_in: expiresIn,
      token_type: tokenType,
      scope,
      ...extra
    } = reply

    const expires = Date.now() + expiresIn * 1000

    const token = {
      accessToken,
      expiresIn,
      expires,
      scope,
      tokenType,
      ...extra,
    }

    await this.tokenCache.setToken(this.cacheKey, token, expiresIn)

    return token
  }
}

module.exports = PlatformshApiProvider
