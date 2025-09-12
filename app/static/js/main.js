// Minimal JS: future gallery interactions can go here.
document.addEventListener('DOMContentLoaded', () => {
  // Smooth anchor scroll for internal links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'))
      if (target) {
        e.preventDefault()
        target.scrollIntoView({ behavior: 'smooth' })
      }
    })
  })
})


