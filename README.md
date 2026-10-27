# CivicAI — Smart Civic Issue Reporting & Resolution System

An AI-powered platform that helps citizens report civic issues and enables authorities to manage, assign, track, and resolve them efficiently.

CivicAI aims to improve urban cleanliness, public infrastructure, and civic responsibility through technology, intelligent issue classification, and transparent complaint tracking.

## Overview

CivicAI is a crowdsourced civic issue reporting platform designed to connect citizens with the departments responsible for resolving local problems. Citizens can submit reports about issues such as potholes, garbage accumulation, and broken streetlights. Administrators can monitor complaints, prioritize issues, assign departments, and track resolution progress.

## Key Features

- **Civic Issue Reporting:** Submit civic complaints with descriptions and supporting images.
- **Location-Based Reports:** Associate issues with geographic locations for easier identification.
- **AI-Assisted Classification:** Analyze reported issues and help categorize them.
- **Priority Management:** Support prioritization of complaints based on issue severity.
- **Duplicate Detection:** Help identify potentially repeated reports.
- **Admin Dashboard:** Monitor complaints, users, departments, and resolution activity.
- **Department Routing:** Route reports to the appropriate civic department.
- **Status Tracking:** Track complaint progress from submission to resolution.
- **Notifications:** Support updates about complaint status and activity.
- **Maps and Analytics:** Visualize reported issues and monitor civic complaint trends.
- **Authentication and Access Control:** Support protected application features and role-based access.

*Feature availability depends on the configured services and deployed application version.*

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui |
| Backend and Database | Supabase |
| Server-Side Functions | Supabase Edge Functions |
| Database Management | SQL migrations |
| AI Integration | Google Gemini, where configured |
| Maps and Geolocation | Map-based location services |
| Version Control | Git and GitHub |

## Project Structure

```text
CivicAI/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable UI components
│   ├── pages/              # Application pages
│   └── ...                 # Hooks, services and utilities
├── supabase/
│   ├── functions/          # Server-side Edge Functions
│   └── migrations/         # Database schema migrations
├── .env.example            # Environment variable template
├── .gitignore
├── package.json
├── package-lock.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

## Getting Started

### Prerequisites

Install the following before running the project:

- Node.js (compatible with the project dependencies)
- npm
- Git
- A Supabase project with the required configuration

### 1. Clone the Repository

```bash
git clone https://github.com/Shyam241209/CivicAI.git
cd CivicAI
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a local `.env` file based on `.env.example`.

```bash
cp .env.example .env
```

On Windows PowerShell, you can instead run:

```powershell
Copy-Item .env.example .env
```

Fill in the required values using your own Supabase project settings and any other services required by the application.

**Security:** Never commit `.env` files, private API keys, database passwords, or Supabase service-role keys to GitHub.

### 4. Configure Supabase

1. Create or select your Supabase project.
2. Configure the required environment variables and authentication providers.
3. Review the SQL migrations in `supabase/migrations/`.
4. Apply the migrations to the intended database using the appropriate Supabase workflow.
5. Configure the required Edge Functions and their secrets.

Review migrations before applying them to an existing database.

### 5. Run the Development Server

```bash
npm run dev
```

Open the local URL displayed in your terminal, usually:

`http://localhost:8080/`

### 6. Build for Production

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## Application Workflow

1. A citizen submits a civic issue with a description, image, and location where supported.
2. The application analyzes the report and helps categorize the issue.
3. Potential duplicates and issue priority can be evaluated.
4. An administrator reviews the report and routes it to the appropriate department.
5. The responsible department works on resolving the issue.
6. The complaint status and history help users track progress.

## Project Goals

- Encourage citizen participation in civic problem-solving.
- Improve visibility into local infrastructure and sanitation issues.
- Reduce manual complaint handling and routing.
- Support more transparent complaint tracking.
- Help authorities identify recurring problems and prioritize resources.

## Future Enhancements

- Multilingual reporting for regional languages, including Tamil.
- Voice-based complaint submission.
- Improved duplicate detection and severity prediction.
- Civic issue hotspot analysis.
- Automated progress summaries and resolution insights.
- Expanded accessibility and mobile experience.

## Contribution

Contributions, suggestions, and bug reports are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Open a pull request describing your improvements.

## Security

Do not publish API credentials, private keys, access tokens, or personal information. Report security concerns responsibly without exposing sensitive data.

## Author

**Shyam Sundar V**

- GitHub: [@Shyam241209](https://github.com/Shyam241209)
- Project Repository: [CivicAI](https://github.com/Shyam241209/CivicAI)

---

**CivicAI — Building smarter, cleaner, and more responsive communities through technology.**
