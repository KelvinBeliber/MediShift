# MediShift - AI-Powered Healthcare Workforce Management System

## Overview
MediShift is a full-stack healthcare workforce management platform designed for hospitals and healthcare organizations. The system centralizes employee management, intelligent shift scheduling, attendance tracking, leave management, payroll preparation, and analytics into a single application.

The core feature is an AI-assisted scheduling engine powered by Google OR-Tools CP-SAT, which automatically generates optimized monthly schedules while respecting staffing requirements, employee availability, labor regulations, certifications, and fairness constraints.

The goal is to build an enterprise-grade SaaS application that demonstrates modern software engineering practices, scalable architecture, and real-world business workflows.

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- TanStack Query
- Zustand
- React Hook Form
- Zod
- FullCalendar
- Framer Motion

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- Socket.io
- Google OR-Tools (CP-SAT)
- Cloudinary
- Multer
- Nodemailer
- Redis (optional)
- BullMQ (optional)

## Core Modules

### 1. Authentication
**Features**
- Login
- Register
- Forgot Password
- Reset Password
- Email Verification
- JWT Authentication
- Refresh Tokens
- Protected Routes
- Role-Based Access Control (RBAC)

**Roles**
- Super Admin
- Hospital Administrator
- HR Manager
- Department Head
- Shift Coordinator
- Employee

### 2. Dashboard
Different dashboards depending on role.

**Employee Dashboard**
- Upcoming shifts
- Attendance summary
- Leave balance
- Notifications
- Schedule calendar

**Manager Dashboard**
- Department schedule
- Pending leave requests
- Shift conflicts
- Attendance overview
- Team statistics

**Admin Dashboard**
- Employee count
- Department overview
- Staffing levels
- Open shifts
- Overtime summary
- Hospital analytics

### 3. Employee Management
**Employee Profile**
- Photo
- Employee ID
- Name
- Email
- Phone
- Address
- Emergency Contact
- Department
- Position
- Employment Type
- Hire Date
- Salary (optional)
- Status
- Skills
- Certifications
- Medical License Number
- Documents

**Document Upload**
- Resume
- Contract
- Government IDs
- Medical License
- Certifications
- Training Certificates

### 4. Department Management
**Departments**
- Emergency
- ICU
- Operating Room
- Pediatrics
- Radiology
- Laboratory
- Cardiology
- Neurology
- Pharmacy
- Reception
- Billing
- Maintenance
- Security

**Each department has**
- Manager
- Employees
- Schedule
- Staffing requirements

### 5. Position Management
**Example Positions**
- Doctor
- Nurse
- Resident
- Intern
- Pharmacist
- Laboratory Technician
- Radiologist
- Receptionist
- Security
- Maintenance

**Each position stores**
- Salary Range
- Required Certifications
- Required Skills
- Default Working Hours

### 6. Certification Management
**Examples**
- ICU Certified
- ACLS
- BLS
- Pediatric Certified
- Trauma Certified
- Radiology Certified

Scheduling engine must respect certification requirements.
Example: Only ICU-certified nurses can be scheduled in ICU.

### 7. Shift Management
**Shift Types**
- Morning
- Afternoon
- Night
- Weekend
- Holiday
- On-Call
- Overtime
- Half Day

**Shift Information**
- Start Time
- End Time
- Department
- Required Staff
- Assigned Employees

**Views**
- Daily
- Weekly
- Monthly
- Timeline

Support drag-and-drop editing.

### 8. AI Schedule Generator (Main Feature)
Implement automatic schedule generation using Google OR-Tools CP-SAT.

**Scheduling Constraints**
- Employee availability
- Approved leave
- Sick leave
- Required certifications
- Department assignment
- Maximum weekly hours
- Maximum monthly hours
- Minimum rest period
- Maximum consecutive work days
- Night shift rotation
- Weekend fairness
- Public holidays
- Employee preferences
- Overtime limits
- Required staffing levels
- Labor regulations

The scheduler should automatically generate a complete monthly schedule while minimizing conflicts and balancing workloads fairly.
Managers can review, edit, and publish the generated schedule.

### 9. Attendance Management
**Features**
- Clock In
- Clock Out
- Break Start
- Break End
- Attendance History

**Statuses**
- Present
- Late
- Absent
- Leave
- Holiday
- Overtime

**Optional Features**
- GPS Verification
- QR Code Attendance

### 10. Leave Management
**Leave Types**
- Vacation Leave
- Sick Leave
- Emergency Leave
- Maternity Leave
- Paternity Leave
- Bereavement Leave
- Study Leave

**Workflow**
Employee submits request → Department Head reviews → HR approves → Schedule automatically updates

### 11. Shift Swap Requests
**Workflow**
Employee requests shift swap → Another employee accepts → Manager approves → Schedule updates automatically → Notifications sent to both employees

### 12. Payroll Preparation
Generate payroll input data.

**Calculate**
- Total Hours Worked
- Overtime
- Night Differential
- Holiday Hours
- Tardiness
- Undertime
- Absences

**Export**
- CSV
- Excel
- PDF

### 13. Notifications
**Notify users when**
- Schedule published
- Schedule changed
- Leave approved
- Leave rejected
- Shift swap approved
- New announcement
- Upcoming shift reminder

**Channels**
- In-App
- Email
- Browser Notifications

### 14. Announcements
- Hospital-wide announcements
- Department announcements
- Priority levels: Normal, Important, Emergency

### 15. Internal Messaging
Real-time messaging using Socket.io

**Support**
- Direct Messages
- Department Group Chat

### 16. Reports & Analytics
**Charts**
- Attendance Trends
- Leave Statistics
- Overtime Trends
- Staffing Levels
- Department Utilization

**Reports**
- Attendance Report
- Leave Report
- Payroll Summary
- Employee Performance
- Shift Coverage

**Export**
- PDF
- Excel

### 17. AI Assistant (Future Version)
Managers can ask questions like:
- Who worked the most overtime this month?
- Which department is understaffed?
- Generate next month's schedule.
- Why couldn't an employee be assigned?
- Show employees nearing overtime limits.

## Database Collections
- users
- roles
- permissions
- departments
- positions
- certifications
- employees
- schedules
- shifts
- attendance
- leaveRequests
- shiftSwapRequests
- announcements
- notifications
- messages
- payrollInputs
- documents
- auditLogs
- systemSettings

## Application Pages
- Authentication (Login, Register, Forgot Password, Reset Password)
- Dashboard
- Employee Management
- Employee Details
- Departments
- Positions
- Certifications
- Schedules
- Calendar
- Attendance
- Leave Requests
- Shift Swap Requests
- Announcements
- Messages
- Reports
- Analytics
- Payroll Inputs
- Notifications
- Settings
- Profile
- Audit Logs

## Development Roadmap

### Phase 1 - Foundation
- Authentication
- User Management
- Employee Management
- Departments
- Roles & Permissions

### Phase 2 - Workforce Management
- Shift Management
- Calendar
- Attendance
- Leave Requests
- Shift Swaps

### Phase 3 - AI Scheduling
- Google OR-Tools CP-SAT Integration
- Automatic Schedule Generation
- Constraint Validation
- Schedule Publishing

### Phase 4 - Communication
- Notifications
- Messaging
- Announcements

### Phase 5 - Analytics
- Reports
- Charts
- Payroll Preparation
- Dashboard Improvements

### Phase 6 - Polish
- Responsive Design
- Animations
- Accessibility
- Testing
- Performance Optimization
- Deployment

## Future Enhancements
- Multi-hospital support
- SaaS subscriptions
- Google Calendar integration
- SMS notifications
- Face recognition attendance
- Mobile PWA
- Offline attendance sync
- AI staffing forecasts
- Predictive staffing recommendations
- Voice-enabled AI assistant

## Primary Goal
Build an enterprise-level Healthcare Workforce Management System that showcases:
- Advanced MERN architecture
- Complex business logic
- AI-powered scheduling with Google OR-Tools CP-SAT
- Role-based access control
- Real-time communication
- Scalable backend design
- Professional UI/UX
- Production-ready code organization
- Strong portfolio value for senior full-stack engineering roles
