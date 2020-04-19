import { Head } from '@postjs/core'
import React from 'react'
import Nav from '../components/nav'

export default function Home({ style }: any) {
    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'white',
                color: 'black',
                ...style
            }}
        >
            <Head>
                <title>RGB</title>
            </Head>
            <Nav />
        </div>
    )
}
