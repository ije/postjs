import { Head } from '@postjs/core'
import React from 'react'
import Nav from '../components/nav'

export default function G({ style }: any) {
    return (
        <div style={{
            ...style,
            background: 'green',
            color: 'white',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
        }}>
            <Head>
                <title>G</title>
            </Head>
            <Nav />
        </div>
    )
}
