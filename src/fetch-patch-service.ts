import * as fetchIntercept from 'fetch-intercept'
import { PLUGIN_BASE_PATH } from './constants'
import { getCSRFToken } from './utils/https'
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk'
import { joinPaths } from './utils'

const hawtioFetchPaths = {
  presetConnections: { path: 'preset-connections', regex: /\/\/preset-connections$/ },
  hawtconfig: { path: 'hawtconfig.json', regex: /hawtconfig\.json$/ },
  sessionTimeout: { path: 'auth/config/session-timeout$1', regex: /auth\/config\/session-timeout(.*)/ },
}

interface Headers {
  Authorization?: string
  'Content-Type': string
  'X-XSRF-TOKEN'?: string
  'X-CSRFToken'?: string
}

class FetchPatchService {

  private fetchUnregister?: (() => void) | null

  private basePath = PLUGIN_BASE_PATH

  private csrfToken?: string

  constructor() {
    console.log('Constructing the fetch-patch-service')
    this.setupFetch()
  }

  setupFetch() {
    if (this.fetchUnregister)
      return // Nothing to do

    const gatewayStatusUrl = '/api/proxy/plugin/hawtio-online-console-plugin/gateway/status'
    const echoUrl = '/api/proxy/plugin/hawtio-online-console-plugin/echo/jolokia'

    const podName = 'hawtio-online-example-camel-springboot-os-5-zjpk6'

    consoleFetchJSON(joinPaths(echoUrl, podName))
      .then((response) => {
        console.log('Response for echo proxy:')
        console.log(response)
      })

    this.fetchUnregister = fetchIntercept.register({
      request: (url, requestConfig) => {
        for (const fetchPath of Object.values(hawtioFetchPaths)) {
          if (url.match(fetchPath.regex)) {
            url = url.replace(fetchPath.regex, `${this.basePath}/${fetchPath.path}`)
          }
        }

        console.log(`Fetching url ${url}`)

        // Include any requestConfig headers to ensure they are retained
        let headers: Headers = {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sha256~tLPE3K-iFFkXj3kBpb1IzG7Cm-iVJ1wr8ArUx-KLrTc'
        }

        // Required token for protected authenticated access
        // to cluster from the console
        this.csrfToken = getCSRFToken()
        console.log(`CSRF TOKEN: ${this.csrfToken}`)

        if (this.csrfToken) {
          headers = {
            ...headers,
            'X-CSRFToken': this.csrfToken,
          }
        }

        /*
         * if requestConfig exists and already has a set of headers
         */
        if (requestConfig && requestConfig.headers) {
          headers = { ...requestConfig.headers, ...headers }
        }

        console.log('Sending Request headers:')
        console.log(headers)

        // headers must be 2nd so that it overwrites headers property in requestConfig
        return [url, { ...requestConfig, headers }]
      },
    })
  }

  destroy() {
    // Unregister this fetch handler before logging out
    this.fetchUnregister?.()
    this.fetchUnregister = null
  }

  public getBasePath() {
    return this.basePath
  }

}

export const fetchPatchService = new FetchPatchService()
