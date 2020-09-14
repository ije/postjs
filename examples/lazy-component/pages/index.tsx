import { Head, LazyComponent } from '@postjs/core'
import React from 'react'

export default function Home() {
    return (
        <div style={{
            boxSizing: 'border-box',
            position: 'absolute',
            top: 0,
            left: 0,
            padding: 50,
            lineHeight: '24px',
            width: '100%',
            height: '100%',
            background: 'wheat'
        }}>
            <Head>
                <title>Welcome to use postjs!</title>
            </Head>
            <p>Welcome to use <strong>postjs</strong>!</p>
            <LazyComponent is="nav">
                ...
                <br />
                ...
            </LazyComponent>
        </div>
    )
}
