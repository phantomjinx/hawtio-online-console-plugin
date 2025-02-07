import { fetchPatchService } from "./fetch-patch-service"
import {
  camel,
  configManager,
  consoleStatus,
  hawtio,
  jmx,
  logs,
  quartz,
  rbac,
  ResolveUser,
  runtime,
  springboot,
  userService,
  Logger,
} from '@hawtio/react'
import { HAWTIO_ONLINE_VERSION } from './constants'
import { log } from './globals'

class HawtioService {

  private hawtioReady: boolean = false
  private error?: Error

  constructor() {
    // Disable the authentication requirements by specifying a user
    // that is already logged-in
    userService.addFetchUserHook('auth-disabled', this.fetchUser)
  }

  private bootstrapPlugin(pluginIds: string[], id: string, bootstrap: Function) {
    const idx = pluginIds.findIndex(pluginId => pluginId === id)
    if (idx > -1) {
      log.debug(`(hawtio-service) Plugin already resolved: ${id}`)
      return
    }

    log.debug(`(hawtio-service) Resolving plugin: ${id}`)
    bootstrap()
  }

  public async init() {
    if (this.isHawtioReady()) {
      return
    }

    await userService.fetchUser()
    configManager.addProductInfo('Hawtio Online', HAWTIO_ONLINE_VERSION)

    hawtio.setBasePath(fetchPatchService.getBasePath())

    const pluginIds = hawtio
      .getPlugins()
      .map(plugin => plugin.id)

      // Register Hawtio builtin plugins
    this.bootstrapPlugin(pluginIds, 'consolestatus', consoleStatus)
    this.bootstrapPlugin(pluginIds, 'jmx', jmx)
    this.bootstrapPlugin(pluginIds, 'camel', camel)
    this.bootstrapPlugin(pluginIds, 'runtime', runtime)
    this.bootstrapPlugin(pluginIds, 'logs', logs)
    this.bootstrapPlugin(pluginIds, 'quartz', quartz)
    this.bootstrapPlugin(pluginIds, 'springboot', springboot)

    // Bootstrap Hawtio
    log.debug('(hawtio-service) Bootstrapping hawtio ...')
    await hawtio.bootstrap()

    await hawtioService.setHawtioReady()
  }

  getError() {
    return this.error
  }

  isHawtioReady() {
    return this.hawtioReady
  }

  private async setHawtioReady() {
    log.debug('(hawtio-service) Checking Hawtio is ready ...')

    log.debug('(hawtio-service) Resolving plugins status')
    const plugins = await hawtio.resolvePlugins()
    if (plugins.length === 0) {
      this.error = new Error('All plugins failed to resolve')
      this.hawtioReady = false
      return
    }

    // for (const plugin of plugins) {
    //   if (plugin.id === 'jmx') {
        this.hawtioReady = true
      // }
    // }

    // No jmx plugin is probably not what we are after
    // this.error = new Error('Plugins are resolved but jmx is not available')
    // this.hawtioReady = false
  }

  async fetchUser(resolve: ResolveUser): Promise<boolean> {
    resolve({ username: 'auth-disabled', isLogin: true, isLoading: false })
    return true
  }

  destroy() {
    // TODO What if anything can be done to stop the jolokia connection
    // jolokiaService
  }
}

export const hawtioService = new HawtioService()
