import { CSSProperties } from 'react'
import utils from '../utils'

export interface PageTransition {
    enter: Transition | Transition[]
    exit: Transition | Transition[]
}

export type TimingFunction = 'linear'
    | 'ease'
    | 'easeIn'
    | 'easeOut'
    | 'easeInOut'
    | 'easeInSine'
    | 'easeOutSine'
    | 'easeInOutSine'
    | 'easeInQuad'
    | 'easeOutQuad'
    | 'easeInOutQuad'
    | 'easeInCubic'
    | 'easeOutCubic'
    | 'easeInOutCubic'
    | 'easeInQuart'
    | 'easeOutQuart'
    | 'easeInOutQuart'
    | 'easeInQuint'
    | 'easeOutQuint'
    | 'easeInOutQuint'
    | 'easeInExpo'
    | 'easeOutExpo'
    | 'easeInOutExpo'
    | 'easeInCirc'
    | 'easeOutCirc'
    | 'easeInOutCirc'
    | 'easeInBack'
    | 'easeOutBack'
    | 'easeInOutBack'
    | CubicBezier

// easings.net
const cubicBezierTimingPresets = {
    easeInSine: 'cubic-bezier(0.47, 0, 0.745, 0.715)',
    easeOutSine: 'cubic-bezier(0.39, 0.575, 0.565, 1)',
    easeInOutSine: 'cubic-bezier(0.445, 0.05, 0.55, 0.95)',
    easeInQuad: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
    easeOutQuad: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    easeInOutQuad: 'cubic-bezier(0.455, 0.03, 0.515, 0.955)',
    easeInCubic: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
    easeOutCubic: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
    easeInOutCubic: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    easeInQuart: 'cubic-bezier(0.895, 0.03, 0.685, 0.22)',
    easeOutQuart: 'cubic-bezier(0.165, 0.84, 0.44, 1)',
    easeInOutQuart: 'cubic-bezier(0.77, 0, 0.175, 1)',
    easeInQuint: 'cubic-bezier(0.755, 0.05, 0.855, 0.06)',
    easeOutQuint: 'cubic-bezier(0.23, 1, 0.32, 1)',
    easeInOutQuint: 'cubic-bezier(0.86, 0, 0.07, 1)',
    easeInExpo: 'cubic-bezier(0.95, 0.05, 0.795, 0.035)',
    easeOutExpo: 'cubic-bezier(0.19, 1, 0.22, 1)',
    easeInOutExpo: 'cubic-bezier(1, 0, 0, 1)',
    easeInCirc: 'cubic-bezier(0.6, 0.04, 0.98, 0.335)',
    easeOutCirc: 'cubic-bezier(0.075, 0.82, 0.165, 1)',
    easeInOutCirc: 'cubic-bezier(0.785, 0.135, 0.15, 0.86)',
    easeInBack: 'cubic-bezier(0.6, -0.28, 0.735, 0.045)',
    easeOutBack: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    easeInOutBack: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
}

export class Transition<K extends keyof CSSProperties = any> {
    key: K
    value: CSSProperties[K]
    activeValue: CSSProperties[K]
    duration: number
    timing?: TimingFunction
    delay?: number

    constructor(
        key: K,
        value: CSSProperties[K],
        activeValue: CSSProperties[K],
        duration: number,
        timing?: TimingFunction,
        delay?: number
    ) {
        this.key = key
        this.value = value
        this.activeValue = activeValue
        this.duration = Math.max(Math.round(duration), 0)
        this.timing = timing
        this.delay = delay
    }
}

export function transition<K extends keyof CSSProperties>(
    key: K,
    value: CSSProperties[K],
    activeValue: CSSProperties[K],
    duration: number,
    timing?: TimingFunction,
    delay?: number
): Transition<K> {
    return new Transition(key, value, activeValue, duration, timing, delay)
}

export function fadeIn(duration: number, timing?: TimingFunction, delay?: number) {
    return transition('opacity', 0, 1, duration, timing, delay)
}

export function fadeOut(duration: number, timing?: TimingFunction, delay?: number) {
    return transition('opacity', 1, 0, duration, timing, delay)
}

export function transitionsToStyle(a: Transition | Transition[]): [CSSProperties, CSSProperties, number] {
    const style: CSSProperties = {}
    const activeStyle: CSSProperties = {}
    const cssTransitions: Map<string, string> = new Map()
    const durations: Array<number> = []
    a = Array.isArray(a) ? a : [a]
    a.forEach(({ key, value, activeValue, duration, timing: t, delay }) => {
        let timing = 'ease'
        if (t) {
            if (t instanceof CubicBezier) {
                timing = t.toString()
            } else if (t in cubicBezierTimingPresets) {
                timing = cubicBezierTimingPresets[t]
            } else if (/^(linear|ease|easeIn|easeOut|easeInOut)$/.test(t)) {
                timing = t.replace(/[A-Z]/g, c => '-' + c.toLowerCase())
            }
        }
        style[key] = value
        activeStyle[key] = activeValue
        cssTransitions.set(key, `${key} ${duration}ms ${timing}` + (utils.isUNumber(delay) ? ` ${delay}ms` : ''))
        durations.push(duration + (utils.isUNumber(delay) ? delay : 0))
    })
    style['transition'] = activeStyle['transition'] = Array.from(cssTransitions.values()).join(',')
    return [style, activeStyle, Math.max(...durations)]
}

class CubicBezier {
    x1: number
    y1: number
    x2: number
    y2: number

    constructor(x1: number, y1: number, x2: number, y2: number) {
        this.x1 = x1
        this.y1 = y1
        this.x2 = x2
        this.y2 = y2
    }

    toString(): string {
        return `cubic-bezier(${this.x1}, ${this.y1}, ${this.x2}, ${this.y2})`
    }
}

export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
    return new CubicBezier(x1, y1, x2, y2)
}
