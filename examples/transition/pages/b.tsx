import { Head } from '@postjs/core'
import React from 'react'
import Nav from '../components/nav'

export default function B({ style }: any) {
    return (
        <div className="b" style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'blue',
            color: 'white',
            ...style
        }}>
            <Head>
                <title>B</title>
            </Head>
            <Nav />
        </div>
    )
}
