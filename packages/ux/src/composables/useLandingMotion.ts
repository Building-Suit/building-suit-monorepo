import type { Ref } from 'vue'

/** Resolve an unfinished startup immediately on navigation or an explicit loader bypass. */
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T | undefined> {
  return new Promise(resolve => {
    const abort = () => { signal.removeEventListener('abort', abort); resolve(undefined) }
    if (signal.aborted) { resolve(undefined); return }
    signal.addEventListener('abort', abort, { once: true })
    void work.then(value => {
      signal.removeEventListener('abort', abort)
      resolve(value)
    }, () => abort())
  })
}

/** Include lazy/hidden logo variants, which window.load alone does not wait for. */
async function waitForLandingAssets(signal: AbortSignal) {
  const pageLoaded = new Promise<void>(resolve => {
    const finish = () => {
      window.removeEventListener('load', finish)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    if (document.readyState === 'complete' || signal.aborted) { resolve(); return }
    window.addEventListener('load', finish, { once: true })
    signal.addEventListener('abort', finish, { once: true })
  })
  const sources = new Map<string, HTMLImageElement>()
  for (const image of document.images) {
    if (image.getAttribute('src') || image.currentSrc) sources.set(image.currentSrc || image.src, image)
  }
  const images = [...sources.entries()].map(([source, original]) => new Promise<void>(resolve => {
    const image = new Image()
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      image.onload = null
      image.onerror = null
      signal.removeEventListener('abort', finish)
      resolve()
    }
    if (signal.aborted) { finish(); return }
    signal.addEventListener('abort', finish, { once: true })
    image.onload = () => {
      // Decode before revealing the stage; a failed image must not block the site.
      if (typeof image.decode === 'function') void image.decode().then(finish, finish)
      else finish()
    }
    image.onerror = finish
    image.sizes = original.sizes
    // currentSrc is already the browser-selected responsive source, when available.
    if (!original.currentSrc) image.srcset = original.srcset
    image.src = source
  }))
  await abortable(Promise.allSettled([pageLoaded, document.fonts?.ready ?? Promise.resolve(), ...images]), signal)
}

/**
 * Browser-only GSAP orchestration for shared marketing routes.
 * The optional Shop journey is a scrubbed scene with one continuous UI screen.
 * Reduced motion, narrow screens, SSR and GSAP-load failure all retain readable content.
 */
export function useLandingMotion(root: Ref<HTMLElement | null>, preload = false) {
  let dispose: (() => void) | undefined
  let cancelled = false
  // Keep SSR and the first hydration render identical: the loader already exists.
  const isLoading = ref(preload)
  const loaderMounted = ref(false)
  const cleanups: Array<() => void> = []
  let startup: AbortController | undefined
  let bypassMotion = false
  let refreshJourney = () => {}
  const continueWithoutMotion = () => {
    bypassMotion = true
    startup?.abort()
  }

  onMounted(async () => {
    loaderMounted.value = true
    const scope = root.value
    if (!scope) { isLoading.value = false; return }
    const story = scope.querySelector<HTMLElement>('[data-journey]')
    if (!story) isLoading.value = false
    const header = scope.closest('.bs-marketing')?.querySelector('.bs-marketing-header')?.firstElementChild
    const previousHeaderHeight = scope.style.getPropertyValue('--bs-landing-header-height')
    let headerHeight = 72
    const measureHeader = () => {
      if (!(header instanceof HTMLElement)) return
      const height = Math.ceil(header.getBoundingClientRect().height)
      if (height <= 0) return
      const changed = height !== headerHeight
      headerHeight = height
      scope.style.setProperty('--bs-landing-header-height', `${height}px`)
      if (changed) refreshJourney()
    }
    if (story) {
      measureHeader()
      const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measureHeader)
      if (header) observer?.observe(header)
      cleanups.push(() => {
        observer?.disconnect()
        if (previousHeaderHeight) scope.style.setProperty('--bs-landing-header-height', previousHeaderHeight)
        else scope.style.removeProperty('--bs-landing-header-height')
      })
    }

    let releaseScroll = () => {}
    let finishLoading = () => {}
    if (story) {
      startup = new AbortController()
      // The SSR loader is a sibling of main, not inside the inert content.
      // Inert background branches up to body, preserving every previous state.
      const background = new Set<HTMLElement>([scope])
      let branch: HTMLElement = scope
      while (branch.parentElement) {
        const parent = branch.parentElement
        for (const sibling of parent.children) {
          if (sibling instanceof HTMLElement && sibling !== branch &&
              !sibling.matches('[data-landing-loader]') && !sibling.querySelector('[data-landing-loader]')) background.add(sibling)
        }
        if (parent === document.body) break
        branch = parent
      }
      const inertStates = [...background].map(element => ({ element, wasInert: element.inert }))
      const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const overflow = [document.documentElement, document.body].map(element => ({
        element, value: element.style.getPropertyValue('overflow'), priority: element.style.getPropertyPriority('overflow'),
      }))
      let locked = true
      releaseScroll = () => {
        if (!locked) return
        locked = false
        overflow.forEach(({ element, value, priority }) => {
          if (value) element.style.setProperty('overflow', value, priority)
          else element.style.removeProperty('overflow')
        })
      }
      let finished = false
      finishLoading = () => {
        if (finished) return
        finished = true
        releaseScroll()
        inertStates.forEach(({ element, wasInert }) => { element.inert = wasInert })
        isLoading.value = false
        if (previousFocus && previousFocus !== document.body && previousFocus.isConnected && !cancelled) previousFocus.focus({ preventScroll: true })
      }
      cleanups.push(finishLoading)
      overflow.forEach(({ element }) => element.style.setProperty('overflow', 'hidden'))
      inertStates.forEach(({ element }) => { element.inert = true })
      isLoading.value = true
    }

    try {
      // Load motion in parallel with the page assets, but install no timeline yet.
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const motion = reducedMotion ? Promise.resolve(null) : Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).catch(() => null)
      if (story && startup) {
        await nextTick() // Hydrate the existing loader controls before the asset snapshot.
        if (cancelled) return
        document.querySelector<HTMLElement>('[data-landing-loader]')?.focus({ preventScroll: true })
        await waitForLandingAssets(startup.signal)
      }
      const modules = startup ? await abortable(motion, startup.signal) : await motion
      if (cancelled || root.value !== scope || bypassMotion || !modules) return
      // Restore the scrollbar before measuring the camera and pin geometry.
      releaseScroll()
      if (story) measureHeader()
      const [{ gsap }, { ScrollTrigger }] = modules
      gsap.registerPlugin(ScrollTrigger)
      const context = gsap.context(() => {
        // The first-paint loader hides body descendants using inherited visibility.
        // Normalize the scene behind the still-opaque loader BEFORE GSAP reads
        // autoAlpha start values, otherwise its refresh can cache the laptop at 0.
        if (story) gsap.set(scope, { visibility: 'visible' })

        const intro = gsap.utils.toArray<HTMLElement>('[data-landing-intro]')
        if (intro.length) gsap.from(intro, {
          autoAlpha: 0,
          y: 22,
          duration: 0.72,
          stagger: 0.08,
          ease: 'power3.out',
          clearProps: 'opacity,visibility,transform',
        })

        const landingPreview = scope.querySelector<HTMLElement>('[data-landing-preview]')
        if (landingPreview) gsap.from(landingPreview, {
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

        const stage = scope.querySelector<HTMLElement>('[data-journey-stage]')
        if (story && stage) {
          const mm = gsap.matchMedia()
          mm.add({
            desktop: '(min-width: 960px)',
            mobile: '(max-width: 959px)',
            motion: '(prefers-reduced-motion: no-preference)',
            room: '(min-height: 640px)',
          }, media => {
            // Short landscape viewports keep the composed, readable static story.
            if (!media.conditions?.motion || !media.conditions?.room) return
            const desktop = Boolean(media.conditions.desktop)
            const find = (name: string) => stage.querySelector<HTMLElement>(`[data-j-${name}]`)
            const all = (name: string) => [...stage.querySelectorAll<HTMLElement>(`[data-j-${name}]`)]
            const device = find('device')
            const intro = find('intro')
            const progress = find('progress')
            const cursor = find('cursor')
            const click = find('click')
            const captions = all('chapter')
            if (!device || !intro || !progress || !captions.length) return

            // Enhancement is opt-in only after GSAP has loaded. Without it the SSR
            // hero and illustrated transcript are already complete and navigable.
            story.setAttribute('data-j-enhanced', '')
            gsap.set(device, {
              autoAlpha: 1,
              x: 0, y: 0, xPercent: desktop ? -15 : -50, yPercent: -50,
              scale: desktop ? 0.85 : 1, rotationX: desktop ? 5 : 0,
              rotationY: desktop ? -10 : 0, rotationZ: 0,
            })
            const timeline = gsap.timeline({
              defaults: { ease: 'power2.inOut' },
              scrollTrigger: {
                trigger: story, pin: stage, start: () => `top top+=${headerHeight}`,
                end: () => `+=${Math.round(window.innerHeight * (desktop ? 7 : 6))}`,
                scrub: desktop ? 0.65 : 0.35,
                invalidateOnRefresh: true, anticipatePin: 1,
              },
            })
            const to = (name: string, vars: Parameters<typeof gsap.to>[1], at: number) => {
              const targets = all(name)
              if (targets.length) timeline.to(targets, vars, at)
            }
            // Measure layout coordinates inside the screen, independent of its
            // perspective transform. Logical percentages also follow an RTL switch.
            const app = stage.querySelector<HTMLElement>('.bs-film__app')
            const targetPosition = (name: string) => {
              const target = find(name)
              if (!target || !app) return { inline: 50, top: 50 }
              let x = target.offsetWidth / 2
              let y = target.offsetHeight / 2
              let node: HTMLElement | null = target
              while (node && node !== app) {
                x += node.offsetLeft; y += node.offsetTop
                node = node.offsetParent as HTMLElement | null
              }
              const rtl = getComputedStyle(app).direction === 'rtl'
              return { inline: (rtl ? 1 - x / app.clientWidth : x / app.clientWidth) * 100, top: y / app.clientHeight * 100 }
            }
            const point = (name: string, at: number, duration = 0.35) => {
              if (cursor) timeline.to(cursor, {
                insetInlineStart: () => `${targetPosition(name).inline}%`,
                top: () => `${targetPosition(name).top}%`, duration,
              }, at)
            }
            const tap = (name: string, at: number) => {
              if (!click) return
              timeline.set(click, {
                insetInlineStart: () => `${targetPosition(name).inline}%`,
                top: () => `${targetPosition(name).top}%`, scale: 0.45, opacity: 0,
              }, at)
                .to(click, { scale: 1.5, opacity: 0.7, duration: 0.12 }, at)
                .to(click, { scale: 2, opacity: 0, duration: 0.18 }, at + 0.12)
            }

            // 0–2.3: the interface becomes a physical object. Stillness on either
            // side of the movement is intentional; no timed playback or snapping.
            to('scroll-hint', { autoAlpha: 0, duration: 0.25 }, 0.3)
            timeline.to(intro, { autoAlpha: 0, y: -30, duration: 0.55 }, 0.45)
            to('hardware', { autoAlpha: 1, duration: 0.7 }, 0.55)
            timeline.to(device, {
              xPercent: desktop ? -33 : -50, yPercent: -50, scale: desktop ? 0.8 : 0.96,
              rotationX: desktop ? 9 : 3, rotationY: desktop ? -15 : -5,
              rotationZ: desktop ? -1.5 : 0, duration: 1,
            }, 0.75)
            to('light', { xPercent: -10, opacity: 0.5, duration: 1.1 }, 0.85)
            to('room', { autoAlpha: 1, duration: 0.9 }, 1.8)
            timeline.to(device, {
              top: desktop ? '56%' : '68%', scale: desktop ? 0.64 : 0.85,
              rotationY: desktop ? 13 : 0, rotationX: desktop ? 5 : 0,
              rotationZ: 0, duration: 1.1,
            }, 1.85)
            to('bag', { x: 12, rotationZ: -2, duration: 0.8 }, 2.65)
            to('counter-cup', { x: -12, duration: 0.8 }, 2.65)
            to('order', { autoAlpha: 1, y: -8, duration: 0.4 }, 2.7)
            to('order', { autoAlpha: 0, y: -20, duration: 0.3 }, 3.5)

            // 3.5–5.8: approach the same screen from the cashier's side. Catalogue
            // search, product selection and cart changes are explicit timeline state.
            timeline.to(device, {
              xPercent: desktop ? -27 : -50, top: desktop ? '56%' : '65%',
              scale: 1.03, rotationX: 0, rotationY: desktop ? -3 : 0,
              duration: 0.9,
            }, 3.5)
            to('room', { autoAlpha: 0.16, duration: 0.9 }, 3.5)
            to('cursor', { autoAlpha: 1, duration: 0.18 }, 3.95)
            point('search', 4)
            tap('search', 4.35)
            to('search', { borderColor: 'var(--bs-color-brand-premium-gold)', duration: 0.2 }, 4.3)
            to('search-placeholder', { autoAlpha: 0, duration: 0.18 }, 4.4)
            to('search-result', { autoAlpha: 1, duration: 0.2 }, 4.48)
            const others = [...stage.querySelectorAll<HTMLElement>('[data-j-product]:not([data-j-product="0"])')]
            timeline.to(others, { autoAlpha: 0, duration: 0.3 }, 4.48)
            point('product', 4.65)
            tap('product', 5.02)
            to('selected', { autoAlpha: 1, duration: 0.18 }, 5.05)
            to('empty', { autoAlpha: 0, duration: 0.18 }, 5.05)
            to('cart-item', { autoAlpha: 1, y: 0, duration: 0.25 }, 5.12)
            to('count', { autoAlpha: 1, duration: 0.2 }, 5.12)
            to('total-zero', { autoAlpha: 0, duration: 0.15 }, 5.12)
            to('total-value', { autoAlpha: 1, duration: 0.2 }, 5.18)
            to('added', { autoAlpha: 1, y: -5, duration: 0.2 }, 5.12)
            to('added', { autoAlpha: 0, duration: 0.2 }, 5.7)

            // 5.9–7.8: choose a supported payment method; pause at the real
            // confirmation before changing to a completed, fully paid receipt.
            point('method-trigger', 5.85)
            tap('method-trigger', 6.2)
            to('method-menu', { autoAlpha: 1, duration: 0.18 }, 6.2)
            point('cash-option', 6.36, 0.2)
            tap('cash-option', 6.6)
            to('method-menu', { autoAlpha: 0, duration: 0.18 }, 6.67)
            point('checkout', 6.8)
            tap('checkout', 7.1)
            to('checkout', { scale: 0.97, duration: 0.1 }, 7.1)
            to('checkout', { scale: 1, duration: 0.1 }, 7.2)
            to('confirmation', { autoAlpha: 1, duration: 0.25 }, 7.22)
            point('confirm-button', 7.35, 0.3)
            tap('confirm-button', 7.95)
            to('confirm-button', { scale: 0.96, duration: 0.1 }, 7.95)
            to('confirmation', { autoAlpha: 0, duration: 0.23 }, 8.08)
            to('pos', { autoAlpha: 0, duration: 0.23 }, 8.08)
            to('receipt-view', { autoAlpha: 1, duration: 0.3 }, 8.18)
            to('pos-nav', { backgroundColor: 'transparent', color: 'var(--bs-text-muted)', duration: 0.2 }, 8.18)
            to('sales-nav', { backgroundColor: 'var(--bs-color-brand-premium-gold)', color: 'var(--bs-color-brand-deep-structure-navy)', duration: 0.2 }, 8.18)
            point('print', 8.38)
            tap('print', 8.78)
            to('print', { backgroundColor: 'var(--bs-color-brand-premium-gold)', color: 'var(--bs-color-brand-deep-structure-navy)', duration: 0.2 }, 8.78)
            to('cursor', { autoAlpha: 0, duration: 0.15 }, 8.95)

            // 9–10.5: a tactile interpretation of the browser Print action. The
            // document appears where the digital receipt was, then comes forward.
            to('paper-shot', { autoAlpha: 1, duration: 0.2 }, 9)
            const paperShot = find('paper-shot')
            if (paperShot) timeline.fromTo(paperShot, {
              scale: 0.55, rotationY: -8, rotationZ: 0, y: 24,
            }, { scale: desktop ? 1 : 0.92, rotationY: 0, rotationZ: -4, y: 0, duration: 0.85 }, 9)
            timeline.to(device, { scale: desktop ? 0.76 : 0.87, autoAlpha: 0.12, duration: 0.8 }, 9)
            to('room', { autoAlpha: 0, duration: 0.6 }, 9)
            to('light', { opacity: 1, xPercent: -20, duration: 0.8 }, 9)

            // 10.4–12: the very same sale, amount and stock quantity persist into
            // the dashboard. This is operational reporting, never a profit claim.
            to('paper-shot', { xPercent: desktop ? -110 : -50, scale: 0.5, rotationZ: 3, autoAlpha: 0, duration: 0.75 }, 10.35)
            to('thread', { autoAlpha: desktop ? 0.7 : 0, duration: 0.3 }, 10.4)
            to('receipt-view', { autoAlpha: 0, duration: 0.2 }, 10.5)
            to('records', { autoAlpha: 1, duration: 0.2 }, 10.5)
            to('sales-nav', { backgroundColor: 'transparent', color: 'var(--bs-text-muted)', duration: 0.2 }, 10.5)
            to('dashboard-nav', { backgroundColor: 'var(--bs-color-brand-premium-gold)', color: 'var(--bs-color-brand-deep-structure-navy)', duration: 0.2 }, 10.5)
            timeline.to(device, { autoAlpha: 1, scale: desktop ? 0.95 : 1, duration: 0.8 }, 10.5)
            to('thread', { autoAlpha: 0, duration: 0.35 }, 11.1)
            const stock = stage.querySelector<HTMLElement>('.bs-film__stock')
            if (stock) timeline.fromTo(stock, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45 }, 10.9)
            // Hold the physical laptop beside the closing copy instead of fading it away.
            timeline.to(device, { scale: desktop ? 0.8 : 0.85, autoAlpha: 1, y: 0, duration: 0.8 }, 11.9)
            to('light', { opacity: 0.65, xPercent: -5, duration: 1 }, 11.9)
            timeline.to(progress, { scaleX: 1, ease: 'none', duration: 13.5 }, 0)

            const cues: Array<[number, number]> = [
              [1.05, 2.35], [2.55, 3.65], [3.95, 5.8], [6.0, 8.2],
              [8.45, 10.25], [10.55, 11.85], [12.2, 13.5],
            ]
            captions.forEach((caption, index) => {
              const cue = cues[index]
              if (!cue) return
              timeline.fromTo(caption, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.28 }, cue[0])
              if (index < captions.length - 1) timeline.to(caption, { autoAlpha: 0, y: -14, duration: 0.22 }, cue[1])
            })
            // Follow the measured header if its responsive toolbar height changes.
            // Refresh this trigger only, and never revive it after teardown.
            let active = true
            refreshJourney = () => { if (active && !cancelled) timeline.scrollTrigger?.refresh() }
            refreshJourney()
            return () => {
              active = false
              refreshJourney = () => {}
              story.removeAttribute('data-j-enhanced')
            }
          })
          cleanups.push(() => mm.revert())
        }
      }, scope)

      dispose = () => context.revert()
    } finally {
      finishLoading()
    }
  })

  onBeforeUnmount(() => {
    cancelled = true
    startup?.abort()
    cleanups.reverse().forEach(cleanup => cleanup())
    dispose?.()
  })

  return { isLoading, loaderMounted, continueWithoutMotion }
}
