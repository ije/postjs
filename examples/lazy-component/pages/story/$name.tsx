import { Head, URL } from '@postjs/core'
import React from 'react'

export function getStaticPaths() {
    return [
        '/story/rocket',
        '/story/dinosaur'
    ]
}

export function getStaticProps({ params }: URL) {
    if (params.name === 'rocket') {
        return { name: 'Rock·et' }
    }
    if (params.name === 'dinosaur') {
        return { name: 'Dino·saur' }
    }
    return { name: '???' }
}

export default function Story({ name }: { name: string }) {
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
                <title>Hello {name}</title>
            </Head>
            <p>There is a <strong>{name}</strong>!</p>
        </div>
    )
}
