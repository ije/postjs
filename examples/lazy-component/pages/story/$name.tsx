import { Head, useRouter } from '@postjs/core'
import React from 'react'

export function getStaticPaths() {
    return [
        '/story/rocket',
        '/story/dinosaur'
    ]
}

export default function Story() {
    const { params } = useRouter()

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
                <title>Hello {params.name}</title>
            </Head>
            <p>There is a <strong>{params.name}</strong>!</p>
        </div>
    )
}
