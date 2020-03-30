import React from 'react'
import { Head } from './head'

export function Default404Page() {
    return (
        <p>
            <Head><title>404 - Page not found</title></Head>
            <strong><code>404</code></strong>
            <small>&nbsp;-&nbsp;</small>
            <span>Page not found</span>
        </p>
    )
}
