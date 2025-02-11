import React from 'react'
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement,
} from '@patternfly/react-core'
import { NavLink } from 'react-router-dom'
import { ModuleIcon } from '@patternfly/react-icons'
import { hawtio, usePlugins } from '@hawtio/react'
import { log } from '../globals'

export const PluginMenuDropDown: React.FunctionComponent = () => {
  const { plugins, pluginsLoaded } = usePlugins()
  const [isOpen, setIsOpen] = React.useState<boolean>(false)

  if (!pluginsLoaded) {
    log.debug('Loading:', 'plugins =', pluginsLoaded)
    return <></>
  }

  const onFocus = () => {
    const element = document.getElementById('toggle-basic')
    element?.focus()
  }

  const onSelect = () => {
    setIsOpen(false)
    onFocus()
  }

  const filteredPlugins = plugins.filter(plugin => plugin.path != null)
  return (
    <Dropdown
      className='online-header-toolbar-dropdown'
      onSelect={onSelect}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          id='plugin-header-dropdown-toggle'
          className='plugin-header-dropdown-toggle'
          variant={'plain'}
          ref={toggleRef}
          onClick={() => setIsOpen(!isOpen)}
          isExpanded={isOpen}
        >
          <ModuleIcon />
        </MenuToggle>
      )}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    >
      <DropdownList>
        {filteredPlugins.map(plugin => (
          <DropdownItem
            value={1}
            key={plugin.id}
            component={(props: any) => <NavLink {...props} to={hawtio.fullPath(plugin.path!)} /> }
          >
            {plugin.title}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  )
}
