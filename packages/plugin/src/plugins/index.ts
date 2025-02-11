import { hawtio, HawtioPlugin } from "@hawtio/react"
import { PluginMenuDropDown } from "./PluginMenuDropdown"

export const pluginHeaderDropdownId = 'plugin-header-dropdown'
const pluginTitle = 'Plugin Header Dropdown'

/*
 * Plugin dropdown plugin that contributes the plugin dropdown
 * to the header bar.
 *
 * No plugin-path since it is not required to display a
 * link in the nav-bar to display a main component
 */
export const pluginHeaderDropdown: HawtioPlugin = () => {
  hawtio.addPlugin({
    id: pluginHeaderDropdownId,
    title: pluginTitle,
    headerItems: [{ component: PluginMenuDropDown, universal: true }],
    /* Make the order number high to ensure it is never the default */
    order: 200,
    isActive: async () => true,
  })
}
