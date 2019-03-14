'use strict'

const Joi = require('joi')

const errorResponseSchema = Joi.object({
  error: Joi.string()
    .token()
    .required(),
  error_description: Joi.string().optional(),
})

const oauthTokenResponseSchema = Joi.object({
  access_token: Joi.string()
    .token()
    .required(),
  expires_in: Joi.number()
    .integer()
    .min(0)
    .required(),
  token_type: Joi.string()
    .token()
    .required(),
  scope: Joi.string()
    .token()
    .optional(),
  refresh_token: Joi.string()
    .token()
    .optional(),
})

const linkSchema = Joi.object({
  href: Joi.string()
    .uri({ scheme: 'https' })
    .required(),
})

const projectInfoResponseSchema = Joi.object({
  id: Joi.string()
    .token()
    .length(13)
    .required(),
  endpoint: Joi.string()
    .uri({ scheme: 'https' })
    .required(),
  ui: Joi.string()
    .uri({ scheme: 'https' })
    .required(),
  subscription_id: Joi.number().required(),
  owner: Joi.string()
    .guid()
    .required(),
  owner_info: Joi.object({
    type: Joi.string()
      .token()
      .required(),
    username: Joi.string().token(),
    display_name: Joi.string(),
  }),
  _links: Joi.object({
    self: linkSchema,
    owner: linkSchema,
  }),
})

const projectResponseSchema = Joi.object({
  id: Joi.string()
    .token()
    .length(13)
    .required(),
  _links: Joi.object({
    self: linkSchema,
  }).pattern(/^#[a-zA-Z0-9_-]+/, linkSchema),
  created_at: Joi.date()
    .iso()
    .required(),
  updated_at: Joi.date()
    .iso()
    .required(),
  attributes: Joi.object().pattern(Joi.string(), Joi.string()),
  title: Joi.string().required(),
  description: Joi.string(),
  region: Joi.string()
    .hostname()
    .required(),
  subscription: Joi.object({
    license_uri: Joi.string()
      .uri({ scheme: 'https' })
      .required(),
    plan: Joi.string().required(),
    environments: Joi.number()
      .integer()
      .positive()
      .required(),
    storage: Joi.number()
      .positive()
      .integer()
      .multiple(256)
      .required(),
    included_users: Joi.number()
      .positive()
      .required(),
    subscription_management_uri: Joi.string()
      .uri({ scheme: 'https' })
      .required(),
    restricted: Joi.boolean().required(),
    suspended: Joi.boolean().required(),
    user_licenses: Joi.number()
      .integer()
      .positive()
      .required(),
  })
    .description('Subscription information')
    .required(),
  repository: Joi.object({
    url: Joi.string()
      .uri()
      .required(),
    client_ssh_key: Joi.string().required(),
  }).description('Repository information'),
  owner: Joi.string()
    .guid()
    .required(),
  default_domain: Joi.string()
    .hostname()
    .required(),
  status: Joi.object({
    code: Joi.string().required(),
    message: Joi.string().required(),
  }),
  entropy: Joi.string().required(),
})

const environmentResponseSchema = Joi.object({
  id: Joi.string()
    .token()
    .required(),
  _links: Joi.object({
    self: linkSchema,
  }).pattern(/^#[a-zA-Z0-9_-]+/, linkSchema),
  created_at: Joi.date()
    .iso()
    .required(),
  updated_at: Joi.date()
    .iso()
    .required(),
  name: Joi.string().required(),
  machine_name: Joi.string().required(),
  title: Joi.string(),
  attributes: Joi.object().pattern(Joi.string(), Joi.string()),
  parent: Joi.string(),
  close_parent_on_create: Joi.boolean(),
  deployment_target: Joi.string(),
  status: Joi.string().required(),
  http_access: Joi.object({
    is_enabled: Joi.boolean().required(),
    addresses: Joi.array()
      .items(
        Joi.object({
          permission: Joi.string()
            .required()
            .valid('allow', 'deny'),
          address: Joi.string()
            .ip({ version: 'ipv4', cidr: true })
            .required(),
        })
      )
      .required(),
    basic_auth: Joi.object()
      .pattern(Joi.string(), Joi.string())
      .required(),
  }),
  enable_smtp: Joi.boolean().required(),
  restrict_robots: Joi.boolean().required(),
  edge_hostname: Joi.string()
    .hostname()
    .required(),
  backups: Joi.object({
    manual_count: Joi.number()
      .integer()
      .positive()
      .required(),
    schedule: Joi.array()
      .items(
        Joi.object({
          interval: Joi.string().required(),
          count: Joi.number()
            .integer()
            .positive()
            .required(),
        })
      )
      .required(),
  }),
  project: Joi.string()
    .token()
    .length(13)
    .required(),
  is_main: Joi.boolean().required(),
  is_dirty: Joi.boolean().required(),
  has_code: Joi.boolean().required(),
  head_commit: Joi.string()
    .token()
    .required(),
})

module.exports = {
  errorResponseSchema,
  oauthTokenResponseSchema,
  linkSchema,
  projectInfoResponseSchema,
  projectResponseSchema,
  environmentResponseSchema,
}
