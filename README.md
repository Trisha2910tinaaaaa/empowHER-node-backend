# empowHER Backend API

This is the backend API for the empowHER platform, built with Node.js, Express, and MongoDB.

## Features

- **Authentication**: Complete user authentication system with JWT
- **Community**: Create, join, and interact with community groups
- **Jobs**: Job listing and application management
- **Profiles**: User profiles with experience, education, and more

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas)

### Installation

1. Clone the repository
2. Navigate to the backend directory:
   ```
   cd backend-nodejs
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Set up environment variables:
   - Copy the `.env.example` file to `.env`
   - Update the MongoDB URI and JWT secret in the `.env` file

### Running the Server

#### Development mode:

```
npm run dev
```

#### Production mode:

```
npm start
```

### Database Setup

To set up your MongoDB database, you can use the following commands:

1. Start MongoDB locally (if using local installation):

   ```
   mongod
   ```

2. The application will automatically connect to MongoDB using the URI in your `.env` file

3. (Optional) Seed the database with initial data:
   ```
   npm run seed
   ```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login a user
- `GET /api/auth/logout` - Logout a user
- `GET /api/auth/me` - Get current logged in user
- `POST /api/auth/forgotpassword` - Request password reset
- `POST /api/auth/resetpassword/:resettoken` - Reset password

### Communities

- `GET /api/community` - Get all communities
- `GET /api/community/:id` - Get a single community
- `POST /api/community` - Create a new community
- `PUT /api/community/:id` - Update a community
- `PUT /api/community/:id/join` - Join a community
- `PUT /api/community/:id/leave` - Leave a community
- `PUT /api/community/:id/notifications` - Toggle notifications for a community
- `POST /api/community/:id/posts` - Create a post in a community
- `GET /api/community/:id/posts` - Get all posts in a community

### User Profiles

- `GET /api/profile` - Get current user's profile
- `GET /api/profile/user/:id` - Get user profile by ID
- `PUT /api/profile` - Update profile
- `PUT /api/profile/experience` - Add experience
- `DELETE /api/profile/experience/:exp_id` - Delete experience
- `PUT /api/profile/education` - Add education
- `DELETE /api/profile/education/:edu_id` - Delete education
- `GET /api/profile/communities` - Get joined communities
- `GET /api/profile/jobs/applied` - Get applied jobs
- `GET /api/profile/jobs/saved` - Get saved jobs

### Jobs

- `GET /api/job` - Get all jobs
- `GET /api/job/:id` - Get a single job
- `POST /api/job` - Create a new job
- `PUT /api/job/:id` - Update a job
- `DELETE /api/job/:id` - Delete a job
- `PUT /api/job/:id/apply` - Apply for a job
- `PUT /api/job/:id/save` - Save a job
- `PUT /api/job/:id/application/:user_id` - Update application status

## Connecting with the Frontend

The backend API is designed to work with the Next.js TypeScript frontend. The frontend should make requests to these API endpoints to interact with the backend services.
