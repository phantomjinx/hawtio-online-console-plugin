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
          'Content-Type': 'application/json'
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
  //
  //   const pods = [
  //     {
  //       namespace: 'hawtio-dev',
  //       name: 'camel-helloworld-88f6d6496-84mh2',
  //       protocol: 'http',
  //       port: '10001',
  //       jolokiaPath: '/actuator/jolokia/version'
  //     },
  //     {
  //       namespace: 'hawtio-dev',
  //       name: 'hawtio-online-example-camel-springboot-os-5-zjpk6',
  //       protocol: 'https',
  //       port: '8778',
  //       jolokiaPath: '/jolokia/version'
  //     }
  //   ]
  //
  //   for (const pod of pods) {
  //     const path = `/management/namespaces/${pod.namespace}/pods/${pod.protocol}:${pod.name}:${pod.port}${pod.jolokiaPath}`
  //     const sidecarUrl = `${PLUGIN_BASE_PATH}/${path}`
  //
  //     console.log(`=== Trying to get a jolokia path for pod ${pod.name} ===`)
  //     consoleFetchJSON(sidecarUrl)
  //       .then((response) => {
  //         console.log('Response for sidecar proxy:')
  //         console.log(response)
  //       })
  //   }
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
