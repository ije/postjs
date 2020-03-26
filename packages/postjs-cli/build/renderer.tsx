import * as React from 'react'
import { renderToString } from 'react-dom/server'
import { renderHeadToString, RouterContext, RouterStore, URL } from '@postjs/core'
import utils from '../shared/utils'

export async function renderPage(url: URL, PageComponent: React.ComponentType) {
    let staticProps: any = null
    if ('getStaticProps' in PageComponent) {
        const getStaticProps = (PageComponent as any)['getStaticProps']
        if (typeof getStaticProps === 'function') {
            const props = await getStaticProps(url)
            if (utils.isObject(props)) {
                staticProps = props
            }
        }
    }

    const body = renderToString((
        <RouterContext.Provider value={new RouterStore(url)}>
            <PageComponent {...staticProps} />
        </RouterContext.Provider>
    ))
    const helmet = renderHeadToString(4)

    return {
        body,
        helmet,
        staticProps
    }
}
