import * as React from 'react'
import { renderToString } from 'react-dom/server'
import { URL, renderHeadToString } from '@postjs/core'

export async function renderPage(url: URL, PageComponent: React.ComponentType) {
    let props: any = {}
    if ('getStaticProps' in PageComponent) {
        const getStaticProps = (PageComponent as any)['getStaticProps']
        if (typeof getStaticProps === 'function') {
            props = await getStaticProps(url)
        }
    }

    const body = renderToString(<PageComponent url={url} {...props} />)
    const helmet = renderHeadToString()

    return {
        body,
        helmet
    }
}
