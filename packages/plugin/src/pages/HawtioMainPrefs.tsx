/*
 * required to patch fetch
 * its constructor sets up the interceptor before importing hawtio
 * so do not move this down the import list below @hawtio/react
 */
import { fetchPatchService } from "../fetch-patch-service"
import React, { useEffect, useState } from "react"
import { hawtioService } from "../hawtio-service"
import { HawtioLoadingPage, preferencesRegistry } from "@hawtio/react"
import '@hawtio/react/dist/index.css'
import { log } from '../globals'
import { Alert, Card, CardBody, Divider, Nav, NavItem, NavList, Page, PageSection, PageSectionVariants } from "@patternfly/react-core"
import { stack } from "../utils"
import './hawtiomainprefs.css'

interface HawtioMainPrefsProps {
  id: string
}

export const HawtioMainPrefs: React.FunctionComponent<HawtioMainPrefsProps> = (props) => {
  const [isLoading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>()
  const [prefsPageId, setPrefsPageId] = useState<string>('')

  useEffect(() => {
    fetchPatchService.setupFetch()
    return () => {
      hawtioService.destroy()
    }
  }, [])

  useEffect(() => {
    if (isLoading) {
      const awaitServices = async () => {
        log.debug(`Intialising Hawtio Preferences ...`)
        await hawtioService.init()

        if (! hawtioService.isHawtioReady()) {
          setError(new Error('Failure to initialize the HawtioService', { cause: hawtioService.getError() }))
          setLoading(false) // error occurred so loading is done
          return
        }

        if (preferencesRegistry.getPreferences().length > 0)
          setPrefsPageId(preferencesRegistry.getPreferences()[0].id)

        setLoading(false)
      }

      awaitServices()
    }
  }, [isLoading])

  if (isLoading) {
    return (
      <HawtioLoadingPage/>
    )
  }

  if (error) {
    return (
      <PageSection variant={PageSectionVariants.light}>
        <Card>
          <CardBody>
            <Alert variant='danger' title='Error occurred while loading'>
              <textarea readOnly style={{ width: '100%', height: '100%', resize: 'none', background: 'transparent', border: 'none' }}>
                {stack(error)}
              </textarea>
            </Alert>
          </CardBody>
        </Card>
      </PageSection>
    )
  }

  const onPreferencePageClick = (itemId: string|number) => {
    setPrefsPageId(itemId.toString())
  }

  return (
    <Page id="hawtio-preferences">
      <PageSection type='tabs' hasShadowBottom>
        <Nav aria-label='Nav' variant='tertiary'>
          <NavList>
            {preferencesRegistry.getPreferences().map(prefs => (
              <NavItem
                key={prefs.id}
                itemId={prefs.id}
                isActive={prefsPageId === prefs.id}
                onClick={(event, itemId: string|number) => {
                  onPreferencePageClick(itemId)
                }}
              >
                {prefs.title}
              </NavItem>
            ))}
          </NavList>
        </Nav>
      </PageSection>
      <Divider />
      <PageSection variant={PageSectionVariants.dark}>
        {
          preferencesRegistry.getPreferences()
            .filter(prefs => {
              console.log('Testing prefs ' + prefs.id)
              console.log('Result: ' + (prefs.id === prefsPageId))
              return prefs.id === prefsPageId
            })
            .map(prefs => { return React.createElement(prefs.component)})
        }
      </PageSection>
    </Page>
  )
}

export default HawtioMainPrefs
