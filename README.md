🏡 CozyCorner

CozyCorner is a full-stack property booking platform inspired by Airbnb, built with production-style backend architecture and secure authentication.

🔗 Live: https://cozycorner-s64j.onrender.com

✨ Features
Secure authentication (email verification, password reset, account lock)
Atomic booking system preventing double-booking
Multi-image listing upload with Cloudinary lifecycle management
Geo-based search & maps using Mapbox
Transactional rating aggregation from reviews
Host dashboard with analytics insights
Background job queue for booking notifications
Production security (CSRF, CSP, rate limit, sanitization)
🏗️ Tech Stack

Backend: Node.js, Express v5, MongoDB, Mongoose
Auth: Passport-local-mongoose (session-based)
Frontend: EJS, Bootstrap, Vanilla JS
Integrations: Cloudinary, Mapbox, Nodemailer
Deployment: Render

🧠 Architecture

Layered service-oriented design:

Routes → Controllers → Services → Models → DB

External services (Cloudinary, Mapbox, Email)
🚀 Key Highlight

Implements atomic MongoDB booking reservation to prevent race-condition double-booking — simulating real marketplace logic.
