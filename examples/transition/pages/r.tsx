import { Head } from '@postjs/core'
import React from 'react'
import Nav from '../components/nav'

export default function R({ style }: any) {
    return (
        <div style={{
            ...style,
            background: 'red',
            color: 'white',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
        }}>
            <Head>
                <title>R</title>
            </Head>
            <Nav />
        </div>
    )
}
