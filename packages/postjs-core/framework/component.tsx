import React, { PropsWithChildren } from 'react'

interface ComponentProps {
    is: string
}

export const Component = ({ is }: PropsWithChildren<ComponentProps>) => (
    <p>{is}</p>
)
