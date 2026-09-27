import type { Ref } from 'vue'

/**
 * Progressive enhancement for the shared marketing experience.
 *
 * The landing page is fully visible without JavaScript. GSAP is loaded only in
 * the browser, scoped to the supplied root and completely reverted on route
 * changes so ScrollTriggers never survive a remount.
 */
export function useLandingMotion(root: Ref<HTMLElement | null>) {
  let dispose: (() => void) | undefined

  onMounted(async () => {
    const scope = root.value
    if (!scope || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const [{ gsap }, { ScrollTrigger }] = await Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
    ])

    if (!root.value) return
    gsap.registerPlugin(ScrollTrigger)

    const cleanups: Array<() => void> = []
    const context = gsap.context(() => {
      const intro = gsap.utils.toArray<HTMLElement>('[data-landing-intro]')
      gsap.from(intro, {
        autoAlpha: 0,
        y: 22,
        duration: 0.72,
        stagger: 0.08,
        ease: 'power3.out',
        clearProps: 'opacity,visibility,transform',
      })

      gsap.from('[data-landing-preview]', {
        autoAlpha: 0,
        y: 28,
        scale: 0.985,
        duration: 0.9,
        delay: 0.12,
        ease: 'power3.out',
        clearProps: 'opacity,visibility,transform',
      })

      for (const group of gsap.utils.toArray<HTMLElement>('[data-landing-reveal]')) {
        gsap.from(group.children, {
          autoAlpha: 0,
          y: 20,
          duration: 0.58,
          stagger: 0.07,
          ease: 'power2.out',
          clearProps: 'opacity,visibility,transform',
          scrollTrigger: { trigger: group, start: 'top 84%', once: true },
        })
      }

      const workflow = scope.querySelector<HTMLElement>('[data-landing-workflow]')
      const progress = scope.querySelector<HTMLElement>('[data-landing-progress]')
      if (workflow && progress) {
        gsap.fromTo(progress, { scaleY: 0 }, {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: workflow,
            start: 'top 72%',
            end: 'bottom 42%',
            scrub: 0.35,
          },
        })
      }

      const preview = scope.querySelector<HTMLElement>('[data-landing-preview]')
      if (preview && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        const rotateX = gsap.quickTo(preview, 'rotationX', { duration: 0.45, ease: 'power2.out' })
        const rotateY = gsap.quickTo(preview, 'rotationY', { duration: 0.45, ease: 'power2.out' })
        const move = (event: PointerEvent) => {
          const bounds = preview.getBoundingClientRect()
          const x = (event.clientX - bounds.left) / bounds.width - 0.5
          const y = (event.clientY - bounds.top) / bounds.height - 0.5
          rotateX(y * -2.4)
          rotateY(x * 2.8)
        }
        const reset = () => { rotateX(0); rotateY(0) }
        preview.addEventListener('pointermove', move)
        preview.addEventListener('pointerleave', reset)
        cleanups.push(() => {
          preview.removeEventListener('pointermove', move)
          preview.removeEventListener('pointerleave', reset)
        })
      }
    }, scope)

    dispose = () => {
      cleanups.forEach(cleanup => cleanup())
      context.revert()
    }
  })

  onBeforeUnmount(() => dispose?.())
}
