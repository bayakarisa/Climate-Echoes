# 🌍 Climate Echoes
Climate Echoes: Voices of a Generation
======================================

A youth-focused creative climate hub for submissions, exhibitions, and community engagement.

Quick start
-----------

1) Create and activate a virtual environment

   - Windows PowerShell
     - `py -3 -m venv .venv`
     - `.venv\\Scripts\\Activate.ps1`

2) Install dependencies

   - `pip install -r requirements.txt`

3) Run the app

   - `set FLASK_APP=app`
   - `set FLASK_ENV=development`
   - `flask run`

The site will be available at http://127.0.0.1:5000/

Project structure
-----------------

```
Climate-Echoes/
  app/
    __init__.py
    routes.py
    forms.py
    utils.py
    static/
      css/style.css
      js/main.js
      uploads/  (created at runtime)
      logos/
    templates/
      base.html
      index.html
      about.html
      submit.html
      gallery.html
      events.html
      partners.html
      contact.html
  data/
    submissions.json
    messages.json
  requirements.txt
```

Notes
-----

- File uploads are stored under `app/static/uploads/`.
- Submissions and contact messages are stored in JSON under `data/` for simplicity. Swap with a database later if needed.
- The design uses eco-inspired colors and is mobile-first.
**Amplifying youth voices on climate justice through creative expression.**

Climate Echoes is a global storytelling platform for young people (ages 14–30) to share their emotions, challenges, and visions about the climate crisis. Through art, film, music, performance, AI-assisted works, and digital storytelling, we aim to highlight diverse perspectives on climate justice and resilience.  

---

## 🎯 Objectives
- Provide a safe and expressive platform for youth voices on climate change.
- Curate creative works across multiple mediums (photography, film, performance, AI art, music, etc.).
- Showcase submissions in a digital gallery + community pop-up exhibitions.
- Empower young people to shape climate narratives globally.

---

## 📂 Project Structure
- `website/` — Source files for the website (submission portal + digital exhibition).
- `docs/` — Documentation (project proposals, visual identity, sitemaps).
- `submissions/` — Placeholder for collected works (if hosted in-repo).

---


## 🤝 Contributing
We welcome collaborators! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting issues or pull requests.

---

## 📜 License
This project is licensed under [MIT License](LICENSE).
