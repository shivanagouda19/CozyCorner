// Example starter JavaScript for disabling form submissions if there are invalid fields
(() => {
  'use strict'

  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  const forms = document.querySelectorAll('.needs-validation')

  // Loop over them and prevent submission
  Array.from(forms).forEach(form => {
    form.addEventListener('submit', event => {
      if (!form.checkValidity()) {
        event.preventDefault()
        event.stopPropagation()
      }

      form.classList.add('was-validated')
    }, false)
  })

  const mediaSkeletons = document.querySelectorAll('.media-skeleton')

  mediaSkeletons.forEach((block) => {
    const image = block.querySelector('.js-lazy-media')
    if (!image) return

    const markLoaded = () => block.classList.add('is-loaded')

    if (image.complete) {
      markLoaded()
      return
    }

    image.addEventListener('load', markLoaded, { once: true })
    image.addEventListener('error', markLoaded, { once: true })
  })

  const interactiveCards = document.querySelectorAll('.hover-lift')
  interactiveCards.forEach((card) => {
    card.addEventListener('mouseenter', () => {
      card.style.willChange = 'transform'
    })

    card.addEventListener('mouseleave', () => {
      card.style.willChange = 'auto'
    })
  })
})()