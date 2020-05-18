import React from 'https://cdn.pika.dev/react'

export default function Logo({ height = 24 }: { height?: number }) {
    return (
        <img src="/logo.png" height={height} />
    )
}
