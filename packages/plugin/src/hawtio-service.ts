import { fetchPatchService } from "./fetch-patch-service"
import {
  camel,
  configManager,
  consoleStatus,
  hawtio,
  jmx,
  jolokiaService,
  logs,
  quartz,
  ResolveUser,
  runtime,
  springboot,
  userService,
  workspace
} from '@hawtio/react'
import { HAWTIO_ONLINE_VERSION } from './constants'
import { log } from './globals'
import { K8sPod } from "./types"
import { connectionService } from "./connection-service"

class HawtioService {

  private initialized?: boolean = false
  private resolved: boolean = false
  private error?: Error

  constructor() {
    /*
     * Disable the authentication requirements by specifying
     * a user that is already logged-in
     */
    userService.addFetchUserHook('auth-disabled', this.fetchUser)
  }

  private async fetchUser(resolve: ResolveUser): Promise<boolean> {
    resolve({ username: 'auth-disabled', isLogin: true, isLoading: false })
    return true
  }

  private async establishConnection(pod: K8sPod): Promise<boolean> {
    log.debug(`Probing pod ${pod.metadata?.name} ...`)

    try {
      const url = await connectionService.probeJolokiaUrl(pod)
      if (!url) {
        this.setError(new Error('Failed to reach a recognised jolokia url for this pod'))
        return false
      }
    } catch (error) {
      this.setError(new Error(`Cannot access the jolokia url for this pod`, { cause: error }))
      return false
    }

    log.debug(`Connecting to pod ${pod.metadata?.name} ...`)

    /*
     * Set the current connection before initializing
     */
    const error = await connectionService.connect(pod)
    if (error) {
      this.setError(error)
      return false
    }

    return true
  }

  private async initPlugin(pluginIds: string[], id: string, bootstrapCb: Function) {
    const idx = pluginIds.findIndex(pluginId => pluginId === id)
    if (idx > -1) {
      log.debug(`(hawtio-service) Plugin already initialised so refreshing if necessary: ${id}`)
      return
    }

    log.debug(`(hawtio-service) Bootstrapping plugin: ${id}`)
    bootstrapCb()
  }

  public async reset(pod: K8sPod | null) {
    if (! this.isInitialized()) {
      /*
       * Initializing not previously attempted
       */
      await userService.fetchUser()
      configManager.addProductInfo('Hawtio Online', HAWTIO_ONLINE_VERSION)
      hawtio.setBasePath(fetchPatchService.getBasePath())
    }

    hawtioService.setInitialized(true)
    log.debug('(hawtio-service) Hawtio is initialized ...')

    if (! pod) {
      connectionService.clear()
    } else {
      const result = await this.establishConnection(pod)
      if (! result) {
        log.debug('Failed to establish the connection')
        return
      }
    }

    /*
     * Connection established so reset the
     * hawtio/react plugins and services
     */

    const pluginIds = hawtio.getPlugins()
      .map(plugin => plugin.id)

    // Register or refresh Hawtio plugins
    await this.initPlugin(pluginIds, 'consolestatus', consoleStatus)
    await this.initPlugin(pluginIds, 'jmx', jmx)
    await this.initPlugin(pluginIds, 'camel', camel)
    await this.initPlugin(pluginIds, 'runtime', runtime)
    await this.initPlugin(pluginIds, 'logs', logs)
    await this.initPlugin(pluginIds, 'quartz', quartz)
    await this.initPlugin(pluginIds, 'springboot', springboot)

    // Reset the jolokia service
    jolokiaService.reset()

    // Have a connection so reset the workspace
    await workspace.refreshTree()
    const tree = await workspace.getTree()
    log.debug(`Contents of tree ${tree.getTree().length}`)

    // Bootstrap Hawtio
    log.debug('(hawtio-service) Bootstrapping hawtio ...')
    await hawtio.bootstrap()

    await this.resolve()
  }

  getError() {
    return this.error
  }

  private setError(error: Error) {
    this.error = error
  }

  isInitialized() {
    return this.initialized
  }

  private setInitialized(initialized: boolean) {
    this.initialized = initialized
  }

  private async resolve() {
    log.debug('(hawtio-service) Hawtio resolving plugins ...')
    const plugins = await hawtio.resolvePlugins()
    if (plugins.length === 0) {
      this.error = new Error('All plugins failed to resolve')
      this.resolved = false
      return
    }

    /*
     * Plugins have been resolved
     */
    this.resolved = true
  }

  isResolved() {
    return this.resolved
  }

  destroy() {
    jolokiaService.reset()

    connectionService.clear()
  }
}

export const hawtioService = new HawtioService()
