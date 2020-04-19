import { Head } from '@postjs/core'
import React from 'react'
import Nav from '../components/nav'

export default function G({ style }: any) {
    return (
        <div
            className="g"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'green',
                color: 'white',
                ...style
            }}
        >
            <Head>
                <title>G</title>
            </Head>
            <Nav />
        </div>
    )
}
