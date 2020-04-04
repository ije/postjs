import { Head } from '@postjs/core'
import React from 'react'
import Nav from '../components/nav'

export default function R({ style }: any) {
    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'red',
            color: 'white',
            ...style
        }}>
            <Head>
                <title>R</title>
            </Head>
            <Nav />
        </div>
    )
}
