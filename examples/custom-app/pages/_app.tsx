import { Head, Link, Viewport } from '@postjs/core'
import React, { Children, isValidElement, PropsWithChildren } from 'react'

export function getStaticProps() {
    return {
        name: 'postjs',
        description: 'The Post-Front-End Framework'
    }
}

export default function APP({ children, ...staticProps }: PropsWithChildren<{ name: string, description: string }>) {
    return (
        <div style={{ margin: 50 }}>
            <Head>
                <title>* {staticProps.name}</title>
                <Viewport width="device-width" initialScale={1} userScalable />
            </Head>
            <header>
                <h1>* {staticProps.name}</h1>
                <nav>
                    <ul>
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/about">About</Link></li>
                    </ul>
                </nav>
            </header>
            {Children.toArray(children).map(child => {
                if (isValidElement(child)) {
                    return React.cloneElement(child, { ...staticProps, ...child.props }) // inject app staticProps to all pages
                }
            })}
        </div>
    )
}
