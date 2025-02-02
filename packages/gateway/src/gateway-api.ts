/* jshint node: true */
import express from 'express'
import helmet from 'helmet'
import methodOverride from 'method-override'
import cors from 'cors'
import * as fs from 'fs'
import * as https from 'https'
import { logger, expressLogger } from './logger'
import { proxyJolokiaAgent, SSLOptions } from './jolokia-agent'

const environment = process.env.NODE_ENV || 'development'

/*
 * - Specified by default in env file
 * - Can be overriden by env var in deployment resource
 */
const port = process.env.HAWTIO_ONLINE_GATEWAY_APP_PORT || 3000

/*
 * All specified in deployment resource
 *
 */
const sslKey = process.env.HAWTIO_ONLINE_GATEWAY_SSL_KEY || ''
const sslCertificate = process.env.HAWTIO_ONLINE_GATEWAY_SSL_CERTIFICATE || ''
const sslCertificateCA = process.env.HAWTIO_ONLINE_GATEWAY_SSL_CERTIFICATE_CA || ''
const sslProxyKey = process.env.HAWTIO_ONLINE_GATEWAY_SSL_PROXY_KEY || ''
const sslProxyCertificate = process.env.HAWTIO_ONLINE_GATEWAY_SSL_PROXY_CERTIFICATE || ''

function checkEnvVar(envVar: string, item: string) {
  if (!envVar || envVar.length === 0) {
    logger.error(`An ${item} is required but has not been specified`)
    process.exit(1)
  }

  if (!fs.existsSync(envVar)) {
    logger.error(`The ${item} assigned at "${envVar}" does not exist`)
    process.exit(1)
  }
}

checkEnvVar(sslKey, 'SSL Certifcate Key')
checkEnvVar(sslCertificate, 'SSL Certifcate')
checkEnvVar(sslCertificateCA, 'SSL Certifcate Authority')
checkEnvVar(sslProxyKey, 'SSL Proxy Certifcate Key')
checkEnvVar(sslProxyCertificate, 'SSL Proxy Certifcate')

const sslOptions: SSLOptions = {
  certCA: fs.readFileSync(sslCertificateCA),
  proxyKey: fs.readFileSync(sslProxyKey),
  proxyCert: fs.readFileSync(sslProxyCertificate)
}

export const gatewayServer = express()

logger.info('**************************************')
logger.info(`* Environment:       ${environment}`)
logger.info(`* App Port:          ${port}`)
logger.info(`* Log Level:         ${logger.level}`)
logger.info(`* SSL Enabled:       ${sslCertificate !== ''}`)
logger.info(`* Proxy SSL Enabled: ${sslProxyCertificate !== ''}`)
logger.info(`* RBAC:              ${process.env['HAWTIO_ONLINE_RBAC_ACL'] || 'default'}`)
logger.info('**************************************')

// Log middleware requests
gatewayServer.use(expressLogger)

/*
 * Heightens security providing headers
 *
 * - Sets X-Frame-Options: "SAMEORIGIN"
 */
gatewayServer.use(helmet(
  {
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true
    },
    contentSecurityPolicy: {
      directives: {
        'default-src': 'self',
        'frame-ancestors': 'self',
        'form-action': 'self',
      },
    },
  }
))

// Cross Origin Support
gatewayServer.use(cors({
  credentials: true,
}))

// override with the X-HTTP-Method-Override header in the request. simulate DELETE/PUT
gatewayServer.use(methodOverride('X-HTTP-Method-Override'))

/**
 * Provide a status route for the server. Used for
 * establishing a heartbeat when installed on the cluster
 */
gatewayServer.route('/status').get((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.status(200).json({ port: port, loglevel: logger.level})
})

/**
 * Manages the connection to the jolokia server in app
 */
gatewayServer
  .route('/management/*')
  .get((req, res) => {
    proxyJolokiaAgent(req, res, sslOptions)
  })
  .post(express.json({ type: '*/json', limit: '50mb', strict: false }), (req, res) => {
    proxyJolokiaAgent(req, res, sslOptions)
  })

/**
 * Default rule for anything else sent to the server
 */
gatewayServer.route('*').all((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.status(502).json({
    message: `Error (gateway-api): Access to ${req.url} is not permitted.`,
  })
})

/*
 * Must use a wildcard for json Content-Type since jolokia
 * has request payloads with a Content-Type header value of
 * 'text/json' whereas express, by default, only uses
 * 'application/json'.
 *
 * Needs to be added last to avoid being overwritten by the proxy middleware
 */
gatewayServer.use(express.json({ type: '*/json', limit: '50mb', strict: false }))
gatewayServer.use(express.urlencoded({ extended: false }))

/*
 * Exports the running server for use in unit testing
 */
const gatewayHttpsServer = https.createServer(
  {
    key: fs.readFileSync(sslKey),
    cert: fs.readFileSync(sslCertificate),
    ca: sslOptions.certCA,
    requestCert: true,
    rejectUnauthorized: false,
  },
  gatewayServer,
)

export const runningGatewayServer = gatewayHttpsServer.listen(port, () => {
  logger.info(`HTTPS Server running on port ${port}`)
})
