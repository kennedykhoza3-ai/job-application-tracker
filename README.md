# Job Application Tracker

A full-stack web application for tracking job applications, interviews, offers, and rejections.

The application allows users to create an account, log in securely, and manage their own private job applications.

## Features

- User registration
- User login and logout
- Password hashing with bcrypt
- Session-based authentication
- Add job applications
- Edit job applications
- Delete job applications
- Search applications
- Filter applications by status
- Dashboard statistics
- Private applications for each user
- SQLite database storage
- Responsive design

## Technologies Used

### Frontend

- HTML5
- CSS3
- JavaScript

### Backend

- Node.js
- Express.js

### Database

- SQLite

### Security

- bcrypt for password hashing
- express-session for authentication sessions
- Environment variables for sensitive configuration
- Private database excluded from GitHub
- `.env` file excluded from GitHub

## Project Structure

```text
job-application-tracker/
│
├── .env.example
├── .gitignore
├── app.js
├── index.html
├── package-lock.json
├── package.json
├── README.md
├── server.js
└── style.css
```

## Installation

Clone the repository:

```bash
git clone git@github.com:kennedykhoza3-ai/job-application-tracker.git
```

Open the project folder:

```bash
cd job-application-tracker
```

Install the dependencies:

```bash
npm install
```

## Environment Variables

Create a `.env` file in the root of the project.

Use `.env.example` as a guide:

```env
PORT=3000
SESSION_SECRET=replace-this-with-a-long-random-secret
NODE_ENV=development
```

Never upload your real `.env` file to GitHub.

## Run the Application

Start the server:

```bash
npm start
```

Then open your browser and visit:

```text
http://localhost:3000
```

## Application Statuses

Applications can be tracked using the following statuses:

- Applied
- Interview
- Offer
- Rejected

## API Endpoints

### Authentication

```text
POST /api/register
POST /api/login
POST /api/logout
GET  /api/me
```

### Applications

```text
GET    /api/applications
POST   /api/applications
PUT    /api/applications/:id
DELETE /api/applications/:id
```

Application routes require the user to be logged in.

## Data Privacy

The following files and folders are intentionally excluded from GitHub:

```text
.env
applications.db
node_modules/
```

This helps protect private environment variables, locally stored user information, and job application data.

Passwords are not stored as plain text. They are hashed using bcrypt before being saved to the database.

## Future Improvements

Future versions of the application could include:

- Password reset
- Email verification
- Application notes
- Company contact information
- Interview dates
- Document uploads
- Pagination
- Dark mode
- Cloud deployment
- PostgreSQL database support
- Production-ready session storage

## Author

**Kennedy Khoza**

GitHub: `kennedykhoza3-ai`

## License

This project is licensed under the MIT License.