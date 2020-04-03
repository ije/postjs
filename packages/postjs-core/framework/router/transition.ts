import { CSSProperties } from 'react'

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
    | CubicBezierFunction

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

export class Transition {
    enterStyle: CSSProperties
    enterActiveStyle: CSSProperties
    exitStyle: CSSProperties
    exitActiveStyle: CSSProperties
    duration: number | { enter: number, exit: number }
    timing?: TimingFunction | { enter: TimingFunction, exit: TimingFunction }

    constructor(
        enterStyle: CSSProperties,
        enterActiveStyle: CSSProperties,
        exitStyle: CSSProperties,
        exitActiveStyle: CSSProperties,
        duration: number | { enter: number, exit: number },
        timing?: TimingFunction | { enter: TimingFunction, exit: TimingFunction }
    ) {
        this.enterStyle = enterStyle
        this.enterActiveStyle = enterActiveStyle
        this.exitStyle = exitStyle
        this.exitActiveStyle = exitActiveStyle
        this.duration = typeof duration === 'number' ? fixDuration(duration) : { enter: fixDuration(duration.enter), exit: fixDuration(duration.exit) }
        this.timing = timing
    }

    static fade(duration: number, timing?: TimingFunction): Transition {
        return new Transition(
            { opacity: 0 },
            { opacity: 1 },
            { opacity: 1 },
            { opacity: 0 },
            duration,
            timing
        )
    }

    static slide(direction: 'ltr' | 'rtl' | 'ttb' | 'btt', duration: number, timing?: TimingFunction): Transition {
        return new Transition(
            {},
            {},
            {},
            {},
            duration,
            timing
        )
    }

    get enterDuration() {
        if (typeof this.duration === 'number') {
            return this.duration
        }
        return this.duration.enter
    }

    get exitDuration() {
        if (typeof this.duration === 'number') {
            return this.duration
        }
        return this.duration.exit
    }

    get enterTiming(): string {
        if (this.timing !== undefined) {
            const timing: TimingFunction = this.timing['enter'] || this.timing
            if (timing instanceof CubicBezierFunction) {
                return this.timing.toString()
            }
            if (timing in cubicBezierTimingPresets) {
                return cubicBezierTimingPresets[timing].toString()
            }
            return timing.replace(/[A-Z]/g, c => '-' + c.toLowerCase())
        }
        return 'ease'
    }

    get exitTiming(): string {
        if (this.timing !== undefined) {
            const timing: TimingFunction = this.timing['enter'] || this.timing
            if (timing instanceof CubicBezierFunction) {
                return this.timing.toString()
            }
            if (timing in cubicBezierTimingPresets) {
                return cubicBezierTimingPresets[timing].toString()
            }
            return timing.replace(/[A-Z]/g, c => '-' + c.toLowerCase())
        }
        return 'ease'
    }
}

class CubicBezierFunction {
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

export function CubicBezier(x1: number, y1: number, x2: number, y2: number) {
    return new CubicBezierFunction(x1, y1, x2, y2)
}

function fixDuration(d: number) {
    return Math.max(Math.round(d), 50)
}
