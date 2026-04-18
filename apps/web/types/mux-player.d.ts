// Type declarations for Mux Player Web Component custom element
import 'react'

declare module 'react' {
    namespace JSX {
        interface IntrinsicElements {
            'mux-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
                'playback-id'?: string
                'stream-type'?: 'live' | 'on-demand' | 'll-live'
                'autoplay'?: boolean | string
                'muted'?: boolean | string
                'loop'?: boolean | string
                'controls'?: boolean | string
                'poster'?: string
                'style'?: React.CSSProperties
            }
        }
    }
}
