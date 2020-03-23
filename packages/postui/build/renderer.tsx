import * as React from 'react'
import { renderToString } from 'react-dom/server'
import { Router } from '../framework/router'
import { renderHeadToString } from '../framework/head'

export async function renderPage(router: Router, PageComponent: React.ComponentType) {
    let props: any = {}
    if ('getStaticProps' in PageComponent) {
        const getStaticProps = (PageComponent as any)['getStaticProps']
        if (typeof getStaticProps === 'function') {
            props = await getStaticProps(router.url)
        }
    }

    const html = renderToString(<PageComponent {...props} url={router.url} />)
    const helmet = renderHeadToString(4)
    console.log(html)
    console.log(helmet)
}
