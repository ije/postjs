import React from 'https://esm.sh/react/mod.js'

export default function Logo({ height = 24 }: { height?: number }) {
    return (
        <img src="/logo.png" height={height} title="postjs" />
    )
}
