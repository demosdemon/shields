'use strict'

const { promisify } = require('util')
const { Readable } = require('stream')
const redis = require('redis')
const log = require('../../lib/log')

class RedisKeyScanner extends Readable {
  constructor({ scan, prefix = '', ...options }) {
    options = {
      objectMode: true,
      ...options,
    }
    super(options)

    this.scan = scan
    this.cursor = '0'
    this.prefix = prefix
  }

  _error(error) {
    log.error(error)
    process.nextTick(() => this.emit('error', error))
  }

  _matchPrefix(string) {
    if (string.startsWith(this.prefix)) {
      return string.slice(this.prefix.length)
    }

    return undefined
  }

  async _read() {
    if (this.cursor === null) {
      this.push(null)
      return
    }

    try {
      const [cursor, keys] = await this.scan(this.cursor)
      this.cursor = cursor === '0' ? null : cursor
      keys
        .map(v => this._matchPrefix(v))
        .filter(v => v !== undefined)
        // we don't need to handle #push's response
        // it will continue to buffer even after returning false
        .forEach(v => this.push(v))
    } catch (e) {
      this._error(e)
    } finally {
      // must call push at leat once
      if (this._readableState.reading) await this._read()
    }
  }
}

class RedisTokenCache {
  constructor({
    url,
    prefix,
    stringify = JSON.stringify.bind(JSON),
    parse = JSON.parse.bind(JSON),
  }) {
    this.client = redis.createClient({ url, prefix })
    this.client.on('error', e => log.error(e))
    this.prefix = prefix
    this.stringify = stringify
    this.parse = parse
    this._del = promisify(this.client.del.bind(this.client))
    this._get = promisify(this.client.get.bind(this.client))
    this._quit = promisify(this.client.quit.bind(this.client))
    this._scan = promisify(this.client.scan.bind(this.client))
    this._set = promisify(this.client.set.bind(this.client))
    this._setex = promisify(this.client.setex.bind(this.client))
  }

  getKeyStream() {
    return new RedisKeyScanner({
      scan: this._scan,
      prefix: `key:${this.prefix}`,
    })
  }

  async getToken(key) {
    try {
      const value = await this._get(key)
      return this.parse(value)
    } catch (e) {
      log.error(e)
      return undefined
    }
  }

  async deleteToken(key, atomic = false) {
    const n = await this._del(key)
    if (atomic && n === 0) {
      throw new Error('del returned zero keys!')
    }

    return n
  }

  async setToken(key, token, expiresIn = null) {
    const value = this.stringify(token)
    const awaitable =
      expiresIn === null
        ? this._set(key, value)
        : this._setex(key, expiresIn, value)

    return this._resolveOK(awaitable)
  }

  async stop() {
    return this._resolveOK(this._quit())
  }

  async _resolveOK(promiselike) {
    const ok = await Promise.resolve(promiselike)
    if (ok !== 'OK') {
      throw new Error(`Expected an 'OK' response, got ${ok}!`)
    }
  }
}

module.exports = RedisTokenCache
