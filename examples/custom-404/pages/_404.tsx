import { Head } from '@postjs/core'
import React from 'react'

export default function E404() {
    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: '#ffce42',
            color: 'white'
        }}>
            <Head>
                <title>404 - page not found</title>
            </Head>
            <p style={{ margin: 50 }}><strong style={{ borderBottom: '1px #fff dotted' }}>404</strong> - <span style={{ textDecoration: 'wavy' }}>page not found</span></p>
        </div>
    )
}
