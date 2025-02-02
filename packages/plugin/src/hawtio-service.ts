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

  public async init() {
    if (this.isHawtioReady()) {
      return
    }

    // TODO remove at conclusion of development
    Logger.setLevel('DEBUG')

    await userService.fetchUser()
    configManager.addProductInfo('Hawtio Online', HAWTIO_ONLINE_VERSION)

    hawtio.setBasePath(fetchPatchService.getBasePath())

    // Register Hawtio builtin plugins
    consoleStatus()
    jmx()
    rbac()
    camel()
    runtime()
    logs()
    quartz()
    springboot()

    // Bootstrap Hawtio
    log.info('Bootstrapping hawtio ...')
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
    log.debug('Checking Hawtio is ready ...')

    log.debug('Resolving plugins status')
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
