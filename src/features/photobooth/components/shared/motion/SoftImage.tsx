'use client'

import Image, { type ImageProps } from 'next/image'

/** The image is visible by default, including cached images and unhydrated HTML. */
export default function SoftImage(props: ImageProps) {
  return <Image {...props} alt={props.alt} onLoad={(event) => {
    event.currentTarget.classList.add('motion-image-loaded')
    props.onLoad?.(event)
  }} />
}
