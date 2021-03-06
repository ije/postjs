import { Head, Link, Viewport } from '@postjs/core'
import React, { PropsWithChildren } from 'react'

export function getStaticProps() {
    return {
        name: 'postjs',
        description: 'The Post-Front-End Framework'
    }
}

export default function APP({ children, name }: PropsWithChildren<{ name: string }>) {
    return (
        <div style={{ margin: 50 }}>
            <Head>
                <title>* {name}</title>
                <Viewport width="device-width" initialScale={1} userScalable />
            </Head>
            <header>
                <h1>* {name}</h1>
                <nav>
                    <ul>
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/about">About</Link></li>
                    </ul>
                </nav>
            </header>
            {children /* pages */}
        </div>
    )
}
