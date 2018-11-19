'use strict'

const cpuCount = function() {
  if (process.env.OMP_NUM_THREADS !== undefined) {
    return process.env.OMP_NUM_THREADS
  } else {
    let jsonConfig
    try {
      jsonConfig = require('/run/config.json')
    } catch (_) {
      jsonConfig = {
        info: {
          limits: {
            cpu: 1,
          },
        },
      }
    }
    return Math.ceil(jsonConfig.info.limits.cpu)
  }
}

const readBase64JsonVariable = function(variable) {
  const value = process.env[variable]
  if (value === undefined) return {}

  return JSON.parse(Buffer.from(value, 'base64').toString())
}

const config = function() {
  if (process.env.PLATFORM_PROJECT === undefined) return undefined

  const application = readBase64JsonVariable('PLATFORM_APPLICATION')
  const relationships = readBase64JsonVariable('PLATFORM_RELATIONSHIPS')
  const variables = readBase64JsonVariable('PLATFORM_VARIABLES')
  const routes = readBase64JsonVariable('PLATFORM_ROUTES')

  const applicationName = process.env.PLATFORM_APPLICATION_NAME
  const appDir = process.env.PLATFORM_APPLICATION_DIR
  const environment = process.env.PLATFORM_ENVIRONMENT
  const project = process.env.PLATFORM_PROJECT
  const treeId = process.env.PLATFORM_TREE_ID
  const projectEntropy = process.env.PLATFORM_PROJECT_ENTROPY
  const branch = process.env.PLATFORM_BRANCH
  const documentRoot = process.env.PLATFORM_DOCUMENT_ROOT
  const port = process.env.PORT
  const socket = process.env.SOCKET

  return {
    appDir,
    application,
    applicationName,
    branch,
    cpuCount: cpuCount(),
    documentRoot,
    environment,
    port,
    project,
    projectEntropy,
    relationships,
    routes,
    socket,
    treeId,
    variables,
  }
}

const applyPlatformEnvironment = function(config) {
  if (config === null || config === undefined) {
    throw new Error('Expected a configuration object but got nothing!')
  }

  if (config.routes && config.applicationName) {
    const baseUrl = Object.keys(config.routes).find(url => {
      const route = config.routes[url]
      return (
        route &&
        route.type === 'upstream' &&
        route.upstream === config.applicationName
      )
    })

    if (baseUrl) {
      process.env.BASE_URL = baseUrl
      process.env.NEXT_ASSET_PREFIX = baseUrl
      process.env.ALLOWED_ORIGIN = baseUrl
    }
  }

  if (config.relationships) {
    let redisUrl
    for (const relname in config.relationships) {
      for (const rel of config.relationships[relname]) {
        if (rel.scheme === 'redis') {
          redisUrl = `${rel.scheme}://${rel.host}:${rel.port}`
          break
        }
      }
    }

    if (redisUrl) {
      process.env.REDIS_URL = `${redisUrl}/0`
      process.env.REDISTOGO_URL = `${redisUrl}/1`
    }

    // platform.sh does not support ipv6
    process.env.BIND_ADDRESS = process.env.BIND_ADDRESS || '0.0.0.0'
  }
}

module.exports = {
  applyPlatformEnvironment,
  config: config(),
  readBase64JsonVariable,
}
