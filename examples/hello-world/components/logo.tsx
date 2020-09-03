import React from 'react'

export default function Logo({ height = 300 }: { height?: number }) {
    return (
        <img src="/logo.png" height={height} title="postjs" />
    )
}
