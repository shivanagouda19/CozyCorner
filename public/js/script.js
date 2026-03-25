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

  const imageUploadBlocks = document.querySelectorAll('[data-image-upload]')

  imageUploadBlocks.forEach((block) => {
    const input = block.querySelector('[data-upload-input]')
    const previewGrid = block.querySelector('[data-upload-preview]')
    const uploadCount = block.querySelector('[data-upload-count]')
    const uploadLimit = block.querySelector('[data-upload-limit]')
    const uploadError = block.querySelector('[data-upload-error]')
    const dropzone = block.querySelector('[data-upload-dropzone]')
    const deleteCheckboxes = block.querySelectorAll('[data-delete-image]')
    const deleteSummary = block.closest('form')?.querySelector('[data-delete-summary]')

    if (!input || !previewGrid || !uploadCount || !uploadLimit || !uploadError || !dropzone) return

    const maxImages = Number(block.dataset.maxImages || 5)
    const minImages = Number(block.dataset.minImages || 1)
    const existingImages = Number(block.dataset.existingImages || 0)
    const selectedFiles = []

    const modalElement = document.getElementById('uploadPreviewModal')
    const modalImage = document.getElementById('uploadPreviewModalImage')
    const modalTitle = document.getElementById('uploadPreviewModalLabel')
    const previewModal = modalElement && window.bootstrap?.Modal ? new window.bootstrap.Modal(modalElement) : null

    const getFileKey = (file) => `${file.name}-${file.size}-${file.lastModified}-${file.type}`
    const getDeleteCount = () => Array.from(deleteCheckboxes).filter((box) => box.checked).length

    const syncInputFiles = () => {
      const transfer = new DataTransfer()
      selectedFiles.forEach((file) => transfer.items.add(file))
      input.files = transfer.files
    }

    let activeModalObjectUrl = ''
    const openModalPreview = (file) => {
      if (!previewModal || !modalImage || !file) return

      if (activeModalObjectUrl) {
        URL.revokeObjectURL(activeModalObjectUrl)
      }

      activeModalObjectUrl = URL.createObjectURL(file)
      modalImage.src = activeModalObjectUrl
      modalImage.alt = file.name || 'Upload preview'
      if (modalTitle) {
        modalTitle.textContent = file.name || 'Image Preview'
      }

      previewModal.show()
    }

    if (modalElement) {
      modalElement.addEventListener('hidden.bs.modal', () => {
        if (activeModalObjectUrl) {
          URL.revokeObjectURL(activeModalObjectUrl)
          activeModalObjectUrl = ''
        }
        if (modalImage) {
          modalImage.src = ''
        }
      })
    }

    const renderPreview = (files) => {
      previewGrid.innerHTML = ''

      Array.from(files).forEach((file, index) => {
        const card = document.createElement('div')
        card.className = 'upload-preview-card'
        card.dataset.fileIndex = String(index)

        const imageButton = document.createElement('button')
        imageButton.type = 'button'
        imageButton.className = 'upload-preview-open'
        imageButton.dataset.openPreview = String(index)

        const img = document.createElement('img')
        img.className = 'upload-preview-image'
        img.alt = file.name
        img.src = URL.createObjectURL(file)
        img.addEventListener('load', () => URL.revokeObjectURL(img.src), { once: true })
        imageButton.appendChild(img)

        const removeBtn = document.createElement('button')
        removeBtn.type = 'button'
        removeBtn.className = 'upload-preview-remove-btn'
        removeBtn.dataset.removePreview = String(index)
        removeBtn.setAttribute('aria-label', `Remove ${file.name}`)
        removeBtn.textContent = 'x'

        const caption = document.createElement('small')
        caption.className = 'upload-preview-name'
        caption.textContent = file.name

        card.appendChild(imageButton)
        card.appendChild(removeBtn)
        card.appendChild(caption)
        previewGrid.appendChild(card)
      })
    }

    const addFiles = (incomingFiles) => {
      const existingKeys = new Set(selectedFiles.map(getFileKey))

      Array.from(incomingFiles || []).forEach((file) => {
        if (!(file instanceof File)) return

        const key = getFileKey(file)
        if (existingKeys.has(key)) return

        existingKeys.add(key)
        selectedFiles.push(file)
      })

      syncInputFiles()
    }

    const removeFileAtIndex = (index) => {
      if (!Number.isInteger(index) || index < 0 || index >= selectedFiles.length) return

      selectedFiles.splice(index, 1)
      syncInputFiles()
      validateAndRenderMeta()
    }

    const validateAndRenderMeta = () => {
      const selectedCount = selectedFiles.length
      const deleteCount = getDeleteCount()
      const finalCount = existingImages - deleteCount + selectedCount

      uploadCount.textContent = `${selectedCount} / ${maxImages} images selected`
      uploadLimit.textContent = `Final image count: ${Math.max(finalCount, 0)}/${maxImages}`
      if (deleteSummary) {
        deleteSummary.textContent = `${deleteCount} selected for deletion`
      }

      let message = ''
      if (finalCount > maxImages) {
        message = 'You can upload maximum 5 images.'
      } else if (finalCount < minImages) {
        message = 'At least one listing image is required.'
      }

      input.setCustomValidity(message)
      uploadError.textContent = message
      dropzone.classList.toggle('is-invalid', Boolean(message))

      if (selectedCount) {
        renderPreview(selectedFiles)
      } else {
        previewGrid.innerHTML = ''
      }
    }

    input.addEventListener('change', () => {
      addFiles(input.files)
      validateAndRenderMeta()
    })

    deleteCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const card = checkbox.closest('.existing-image-card')
        if (card) {
          card.classList.toggle('is-selected', checkbox.checked)
        }
        validateAndRenderMeta()
      })
    })

    dropzone.addEventListener('dragover', (event) => {
      event.preventDefault()
      dropzone.classList.add('is-dragover')
    })

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('is-dragover')
    })

    dropzone.addEventListener('drop', (event) => {
      event.preventDefault()
      dropzone.classList.remove('is-dragover')

      const files = event.dataTransfer?.files
      if (!files || !files.length) return
      addFiles(files)
      validateAndRenderMeta()
    })

    previewGrid.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-remove-preview]')
      if (removeButton) {
        const index = Number(removeButton.dataset.removePreview)
        removeFileAtIndex(index)
        return
      }

      const openButton = event.target.closest('[data-open-preview]')
      if (openButton) {
        const index = Number(openButton.dataset.openPreview)
        const file = selectedFiles[index]
        openModalPreview(file)
      }
    })

    validateAndRenderMeta()
  })
})()