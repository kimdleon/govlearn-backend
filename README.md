# LMS Backend API

Express.js backend server for the LMS application. This is a separate API service that handles all business logic and database operations.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (Neon)
- npm or yarn

### Installation

```bash
npm install
```

### Environment Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Fill in your environment variables with the correct values from your Vercel settings

### Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Push schema to database
npm run prisma:push

# Or run migrations
npm run prisma:migrate
```

### Development

```bash
npm run dev
```

The API will start on `http://localhost:3001` (or the PORT specified in `.env`)

### Build & Production

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

## API Routes Structure

Routes are organized by feature:
- `/api/auth` - Authentication (login, register, token refresh)
- `/api/courses` - Course management
- `/api/users` - User management
- `/api/webinars` - Webinar management
- `/api/certificates` - Certificate handling
- And more...

## Deployment

This backend is ready to deploy on:
- **Render** (recommended for free tier)
- **Railway** (free tier available)
- **Heroku** (paid)
- **Vercel** (serverless functions)

### Deploy to Render

1. Create account on [render.com](https://render.com)
2. Connect your GitHub repository
3. Create a new Web Service
4. Set environment variables in Render dashboard
5. Deploy!

### Deploy to Railway

1. Create account on [railway.app](https://railway.app)
2. Connect GitHub repository
3. Add PostgreSQL plugin (if not using external DB)
4. Set environment variables
5. Deploy!

## Structure

```
src/
├── server.ts           # Main entry point
├── routes/             # API route handlers
├── middleware/         # Express middleware
├── lib/
│   ├── db.ts          # Prisma client
│   └── auth.ts        # Authentication utilities
└── ...

prisma/
├── schema.prisma      # Database schema
└── migrations/        # Database migrations
```

## Technology Stack

- **Express.js** - Web framework
- **Prisma ORM** - Database access
- **PostgreSQL** - Database
- **TypeScript** - Type safety
- **JWT** - Authentication
