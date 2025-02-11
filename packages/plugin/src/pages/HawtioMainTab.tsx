/*
 * required to patch fetch
 * its constructor sets up the interceptor before importing hawtio
 * so do not move this down the import list below @hawtio/react
 */
import { fetchPatchService } from "../fetch-patch-service"
import React, { useEffect, useState } from "react"
import { Alert, Card, CardBody, PageSection, PageSectionVariants } from "@patternfly/react-core"
import '@patternfly/patternfly/patternfly.css'
import { K8sPod } from "../types"
import { hawtioService } from "../hawtio-service"
import { Hawtio } from "@hawtio/react"
import '@hawtio/react/dist/index.css'
import { stack } from "../utils"
import './hawtiomaintab.css'
import { log } from '../globals'
import { ConsoleLoading } from "./ConsoleLoading"

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
      const awaitService = async () => {
        log.debug(`Intialising Hawtio for pod ${pod.metadata?.name} ...`)
        await hawtioService.reset(pod)

        if (! hawtioService.isResolved()) {
          setError(new Error('Failure to initialize the HawtioService', { cause: hawtioService.getError() }))
          setLoading(false) // error occurred so loading is done
          return
        }

        log.debug(`Hawtio initialize complete for ${pod.metadata?.name} ...`)
        setLoading(false)
      }

      awaitService()
    }
  }, [isLoading])

  if (isLoading) {
    return (
      <ConsoleLoading/>
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
