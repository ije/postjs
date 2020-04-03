import { Head } from '@postjs/core'
import React from 'react'
import Nav from '../components/nav'

export default function Home({ style }: any) {
    return (
        <div style={{
            ...style,
            background: 'white',
            color: 'black',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
        }}>
            <Head>
                <title>RGB</title>
            </Head>
            <Nav />
        </div>
    )
}
