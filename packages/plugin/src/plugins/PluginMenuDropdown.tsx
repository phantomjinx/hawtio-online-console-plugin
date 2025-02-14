import React, { useEffect } from 'react'
import {
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
} from '@patternfly/react-core'
import { NavLink, useLocation } from 'react-router-dom'
import { ModuleIcon } from '@patternfly/react-icons'
import { hawtio, usePlugins, Plugin } from '@hawtio/react'
import { log } from '../globals'

export const PluginMenuDropDown: React.FunctionComponent = () => {
  const { plugins, pluginsLoaded } = usePlugins()
  const location = useLocation()
  const [isOpen, setIsOpen] = React.useState<boolean>(false)
  const [selected, setSelected] = React.useState<string>('')

  const pluginEntry = (plugin: Plugin) => {
    return plugin.title ? plugin.title : plugin.id
  }

  /*
   * On resolving of all plugins
   * set the current plugin in the selected property
   */
  useEffect(() => {
    const filteredPlugins = plugins.filter(plugin => plugin.path != null)
    const activePlugins = filteredPlugins
      .filter(plugin => {
        let pluginPath = hawtio.fullPath(plugin.path!)

        if (!pluginPath.startsWith('/'))
          pluginPath = '/' + pluginPath

        return location.pathname.startsWith(pluginPath)
      })

    const activePlugin = activePlugins.length > 0 ? activePlugins[0] :
      (filteredPlugins.length > 0) ? filteredPlugins[0] : null

    setSelected(activePlugin ? pluginEntry(activePlugin) : '')
  }, [plugins])

  const onToggleClick = () => {
    setIsOpen(!isOpen)
  }

  const onSelect = (_event: React.MouseEvent<Element, MouseEvent> | undefined, value: string | number | undefined) => {
    setSelected(value as string)
    setIsOpen(false)
  }

  if (!pluginsLoaded) {
    log.debug('Loading:', 'plugins =', pluginsLoaded)
    return <></>
  }

  return (
    <Select
      id="single-select"
      className='online-header-toolbar-dropdown'
      isOpen={isOpen}
      selected={selected}
      onSelect={onSelect}
      onOpenChange={(isOpen) => setIsOpen(isOpen)}
      shouldFocusToggleOnSelect
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            id='plugin-header-dropdown-toggle'
            className='plugin-header-dropdown-toggle'
            variant={'plain'}
            ref={toggleRef}
            onClick={onToggleClick}
            isExpanded={isOpen}
          >
            <ModuleIcon /> {selected}
          </MenuToggle>
      )}
    >
      <SelectList>
        {plugins
          .filter(plugin => plugin.path != null)
          .map(plugin => (
            <SelectOption
              value={pluginEntry(plugin)}
              key={plugin.id}
              isSelected={selected === pluginEntry(plugin)}
              component={props => <NavLink {...props} to={hawtio.fullPath(plugin.path!)} /> }
            >
              {pluginEntry(plugin)}
            </SelectOption>
          ))
        }
      </SelectList>
    </Select>
  )
}
