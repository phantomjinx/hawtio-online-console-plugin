/*
 * required to patch fetch
 * its constructor sets up the interceptor before importing hawtio
 * so do not move this down the import list below @hawtio/react
 */
import { fetchPatchService } from "../fetch-patch-service"
import React, { useEffect, useState } from "react"
import { Alert, Card, CardBody, PageSection, PageSectionVariants } from "@patternfly/react-core"
import { K8sPod } from "../types"
import { hawtioService } from "../hawtio-service"
import { HawtioLoadingPage, Hawtio } from "@hawtio/react"
import '@hawtio/react/dist/index.css'
import { connectionService } from "../connection-service"
import { stack } from "../utils"
import './hawtiomaintab.css'

/*
 * Necessary since fetchPatchService is otherwise
 * removed from the component.
 */
console.log(`Using base path: ${fetchPatchService.getBasePath()}`)

interface HawtioMainTabProps {
  ns: string,
  name: string,
  obj: K8sPod
}

export const HawtioMainTab: React.FunctionComponent<HawtioMainTabProps> = (props) => {
  const [isLoading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>()
  const pod = props.obj

  useEffect(() => {
    fetchPatchService.setupFetch()
    return () => {
      hawtioService.destroy()
    }
  }, [])

  useEffect(() => {
    if (isLoading) {
      const awaitServices = async () => {
        try {
          const url = await connectionService.probeJolokiaUrl(pod)
          if (!url) {
            setError(new Error('Failed to reach a recognised jolokia url for this pod'))
            setLoading(false)
            return
          }
        } catch (error) {
          setError(new Error(`Cannot access the jolokia url for this pod`, { cause: error }))
          setLoading(false)
          return
        }

        console.log('connecting ....')
        /*
         * Set the current connection before initializing
         */
        const error = await connectionService.connect(pod)
        if (error) {
          setError(error)
          setLoading(false) // error occurred so loading is done
          return
        }

        console.log('initing ....')
        await hawtioService.init()

        if (! hawtioService.isHawtioReady()) {
          setError(new Error('Failure to initialize the HawtioService', { cause: hawtioService.getError() }))
          setLoading(false) // error occurred so loading is done
          return
        }

        console.log('Ready to go!!!')
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

  return (
    <Hawtio />
  )
}

export default HawtioMainTab
